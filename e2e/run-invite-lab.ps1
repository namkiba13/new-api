param([switch]$SkipBuild, [ValidateSet('invite-rewards.mjs','api-info.mjs','email-language.mjs')][string]$Scenario='invite-rewards.mjs')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot
$temp = Join-Path ([IO.Path]::GetTempPath()) 'opencode'
if (-not (Test-Path -LiteralPath $temp)) { throw 'Create the local temporary opencode directory first' }
$binary = Join-Path $temp 'invite-lab.exe'
if (-not $SkipBuild) {
    & go build -o $binary ./e2e/invite-lab
    if ($LASTEXITCODE) { throw 'Lab build failed' }
}
$env:INVITE_LAB = '1'
$arguments = '-port 4198 -web web/dist'
if ($Scenario -eq 'email-language.mjs') { $arguments += ' -email-lab' }
$process = Start-Process $binary -ArgumentList $arguments -WorkingDirectory $root -RedirectStandardOutput (Join-Path $temp 'invite-lab.log') -RedirectStandardError (Join-Path $temp 'invite-lab-error.log') -WindowStyle Hidden -PassThru
try {
    $ready = $false
    for ($i=0; $i -lt 30; $i++) {
        try { $null = Invoke-RestMethod 'http://127.0.0.1:4198/api/setup' -TimeoutSec 2; $ready=$true; break } catch { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw 'Local lab did not start' }
    & node (Join-Path $PSScriptRoot $Scenario) 'http://127.0.0.1:4198'
    if ($LASTEXITCODE) { throw "HTTP/browser lab failed: $Scenario" }
} finally {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id }
    $env:INVITE_LAB=$null
}
