$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$pkg = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$src = Join-Path $root 'dist\WeekFlow-win32-x64'
$zip = Join-Path $root ("dist\WeekFlow-{0}-win-x64-portable.zip" -f $pkg.version)

if (-not (Test-Path $src)) {
  throw "Packaged folder not found: $src"
}
if (Test-Path $zip) {
  Remove-Item -LiteralPath $zip -Force
}
Compress-Archive -Path (Join-Path $src '*') -DestinationPath $zip -CompressionLevel Optimal
$size = (Get-Item $zip).Length / 1MB
Write-Output ("Created {0} ({1:N1} MB)" -f $zip, $size)
