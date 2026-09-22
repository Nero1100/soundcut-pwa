@echo off
setlocal
set "SOUNDCUT_APP=%~dp0"
where node >nul 2>nul
if not errorlevel 1 (
  node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
  if not errorlevel 1 (
    node "%~dp0launch.cjs"
    if errorlevel 1 pause
    exit /b
  )
)
if exist "%~dp0.runtime\node.exe" (
  "%~dp0.runtime\node.exe" "%~dp0launch.cjs"
  if errorlevel 1 pause
  exit /b
)
echo Preparing Soundcut runtime from nodejs.org. No administrator access is required.
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $root=$env:SOUNDCUT_APP; $runtime=Join-Path $root '.runtime'; New-Item -ItemType Directory -Force -Path $runtime | Out-Null; if (-not [Environment]::Is64BitOperatingSystem) { throw '64-bit Windows is required.' }; $release=(Invoke-RestMethod 'https://nodejs.org/dist/index.json') | Where-Object { $_.lts -and ([int]$_.version.TrimStart('v').Split('.')[0] -ge 22) } | Select-Object -First 1; if (-not $release) { throw 'No supported Node.js release found.' }; $base='https://nodejs.org/dist/'+$release.version+'/'; $relative='win-x64/node.exe'; $sums=(Invoke-WebRequest -UseBasicParsing ($base+'SHASUMS256.txt')).Content; $line=$sums -split [char]10 | Where-Object { $_.Trim().EndsWith(' '+$relative) } | Select-Object -First 1; if (-not $line) { throw 'Checksum is unavailable.' }; $expected=($line.Trim() -split '\s+')[0]; $temporary=Join-Path $runtime 'node.download'; Invoke-WebRequest -UseBasicParsing ($base+$relative) -OutFile $temporary; if ((Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLower() -ne $expected.ToLower()) { throw 'Node.js checksum mismatch.' }; $exe=Join-Path $runtime 'node.exe'; Move-Item -LiteralPath $temporary -Destination $exe -Force; & $exe (Join-Path $root 'launch.cjs'); exit $LASTEXITCODE } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 pause

