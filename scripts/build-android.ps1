param([switch]$SkipDownload)
$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
$taskTools = Join-Path $taskProject '.toolchains/android'
$taskBuild = Join-Path $taskProject 'android/.build'
$taskSource = Join-Path $taskProject 'android/app/src/main'
$taskArtifacts = Join-Path $taskProject 'artifacts/android'
$taskSigning = Join-Path $taskProject '.android-signing'

function Invoke-Checked([string]$Tool, [string[]]$Arguments) {
    & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Android tool failed: $([IO.Path]::GetFileName($Tool))" }
}

$taskBuild = [IO.Path]::GetFullPath($taskBuild)
$taskAndroidDirectory = [IO.Path]::GetFullPath((Join-Path $taskProject 'android'))
if (!$taskBuild.StartsWith($taskAndroidDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($taskBuild) -ne '.build') { throw 'Build cleanup target is outside the Android project.' }
if (Test-Path -LiteralPath $taskBuild) {
    if ((Get-Item -LiteralPath $taskBuild).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing to clean a linked build directory.' }
    Remove-Item -LiteralPath $taskBuild -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $taskTools,$taskBuild,$taskArtifacts,$taskSigning | Out-Null
$taskPackages = @(
    @{Name='platform-36_r02.zip'; Hash='2c1a80dd4d9f7d0e6dd336ec603d9b5c55a6f576'; Folder='platform'},
    @{Name='build-tools_r36_windows.zip'; Hash='f16ccffd34de8790dede813a6c7d8e2c11a27b50'; Folder='build-tools'}
)
foreach ($taskPackage in $taskPackages) {
    $taskArchive = Join-Path $taskTools "archives/$($taskPackage.Name)"
    if (!(Test-Path -LiteralPath $taskArchive)) {
        if ($SkipDownload) { throw 'Missing Android SDK archive.' }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $taskArchive) | Out-Null
        Invoke-WebRequest -Uri "https://dl.google.com/android/repository/$($taskPackage.Name)" -OutFile $taskArchive
    }
    if ((Get-FileHash -LiteralPath $taskArchive -Algorithm SHA1).Hash.ToLowerInvariant() -ne $taskPackage.Hash) { throw 'Android SDK archive verification failed.' }
    $taskDestination = Join-Path $taskTools $taskPackage.Folder
    if (!(Test-Path -LiteralPath $taskDestination)) { Expand-Archive -LiteralPath $taskArchive -DestinationPath $taskDestination }
}
$taskAndroidJar = (Get-ChildItem -LiteralPath (Join-Path $taskTools 'platform') -Filter android.jar -Recurse | Select-Object -First 1).FullName
$taskAapt = (Get-ChildItem -LiteralPath (Join-Path $taskTools 'build-tools') -Filter aapt2.exe -Recurse | Select-Object -First 1).FullName
$taskBin = Split-Path -Parent $taskAapt
if (!$taskAndroidJar -or !$taskAapt) { throw 'Android SDK tools were not found.' }
foreach ($taskFolder in @('generated','classes','dex','policy-tests')) { New-Item -ItemType Directory -Force -Path (Join-Path $taskBuild $taskFolder) | Out-Null }

Invoke-Checked 'javac' @('--release','8','-d',"$taskBuild/policy-tests","$taskSource/java/com/spectrapackmachines/crm/CrmUrls.java","$taskProject/android/tests/CrmUrlsTest.java")
Invoke-Checked 'java' @('-cp',"$taskBuild/policy-tests",'com.spectrapackmachines.crm.CrmUrlsTest')
Push-Location $taskProject
try { Invoke-Checked 'node' @('android/tests/exports.test.cjs'); Invoke-Checked 'node' @('android/tests/mobile.test.cjs') } finally { Pop-Location }

Invoke-Checked $taskAapt @('compile','--dir',"$taskSource/res",'-o',"$taskBuild/resources.zip")
Invoke-Checked $taskAapt @('link','-o',"$taskBuild/unsigned.apk",'-I',$taskAndroidJar,'--manifest',"$taskSource/AndroidManifest.xml",'--java',"$taskBuild/generated",'--min-sdk-version','26','--target-sdk-version','36','-R',"$taskBuild/resources.zip",'--auto-add-overlay')
$taskJava = @(Get-ChildItem "$taskSource/java","$taskBuild/generated" -Filter *.java -Recurse | ForEach-Object FullName)
Invoke-Checked 'javac' (@('--release','8','-encoding','UTF-8','-classpath',$taskAndroidJar,'-d',"$taskBuild/classes") + $taskJava)
$taskClasses = @(Get-ChildItem "$taskBuild/classes" -Filter *.class -Recurse | ForEach-Object FullName)
Invoke-Checked "$taskBin/d8.bat" (@('--release','--min-api','26','--lib',$taskAndroidJar,'--output',"$taskBuild/dex") + $taskClasses)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip = [IO.Compression.ZipFile]::Open("$taskBuild/unsigned.apk", [IO.Compression.ZipArchiveMode]::Update)
try {
    foreach ($taskDex in (Get-ChildItem "$taskBuild/dex" -Filter *.dex)) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZip,$taskDex.FullName,$taskDex.Name) | Out-Null }
    foreach ($taskAsset in (Get-ChildItem "$taskSource/assets" -File)) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZip,$taskAsset.FullName,"assets/$($taskAsset.Name)") | Out-Null }
} finally { $taskZip.Dispose() }
Invoke-Checked "$taskBin/zipalign.exe" @('-f','4',"$taskBuild/unsigned.apk","$taskBuild/aligned.apk")

$taskKey = Join-Path $taskSigning 'spectra-crm.p12'
$taskSecrets = Join-Path $taskSigning 'signing.json'
if (!(Test-Path -LiteralPath $taskSecrets)) {
    if (Test-Path -LiteralPath $taskKey) { throw 'Existing signing identity found without its password file; restore the original file.' }
    $taskBytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Fill($taskBytes)
    @{storePassword=[Convert]::ToBase64String($taskBytes);alias='spectra-crm'} | ConvertTo-Json | Set-Content -LiteralPath $taskSecrets -Encoding utf8
}
$taskIdentity = Get-Content -LiteralPath $taskSecrets -Raw | ConvertFrom-Json
$env:SPECTRA_APK_SIGNING_PASS = $taskIdentity.storePassword
try {
    if (!(Test-Path -LiteralPath $taskKey)) {
        Invoke-Checked 'keytool' @('-genkeypair','-storetype','PKCS12','-keystore',$taskKey,'-alias',$taskIdentity.alias,'-keyalg','RSA','-keysize','3072','-sigalg','SHA256withRSA','-validity','10000','-dname','CN=Spectra Pack Machines,O=Spectra Pack Machines,C=IN','-storepass:env','SPECTRA_APK_SIGNING_PASS','-keypass:env','SPECTRA_APK_SIGNING_PASS','-noprompt')
    }
    $taskManifest = [xml](Get-Content -LiteralPath "$taskSource/AndroidManifest.xml" -Raw)
    $taskVersion = $taskManifest.manifest.GetAttribute('versionName','http://schemas.android.com/apk/res/android')
    $taskApkName = "Spectra-CRM-$taskVersion.apk"
    $taskApk = Join-Path $taskArtifacts $taskApkName
    Invoke-Checked "$taskBin/apksigner.bat" @('sign','--ks',$taskKey,'--ks-key-alias',$taskIdentity.alias,'--ks-pass','env:SPECTRA_APK_SIGNING_PASS','--key-pass','env:SPECTRA_APK_SIGNING_PASS','--out',$taskApk,"$taskBuild/aligned.apk")
    Invoke-Checked "$taskBin/apksigner.bat" @('verify','--verbose','--print-certs',$taskApk)
    Invoke-Checked "$taskBin/zipalign.exe" @('-c','4',$taskApk)
    Invoke-Checked "$taskBin/aapt.exe" @('dump','badging',$taskApk)
    $taskHash = (Get-FileHash -LiteralPath $taskApk -Algorithm SHA256).Hash.ToLowerInvariant()
    "$taskHash  $taskApkName" | Set-Content -LiteralPath "$taskApk.sha256" -Encoding ascii
    Write-Output "APK ready: $taskApk"
} finally { Remove-Item Env:SPECTRA_APK_SIGNING_PASS -ErrorAction SilentlyContinue }
