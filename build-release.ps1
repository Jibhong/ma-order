$ErrorActionPreference = "Stop"
$repository = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repository

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE."
  }
}

$version = Read-Host "Release version without the v prefix (for example, 1.0.1)"
if ($version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') {
  throw "Enter a valid version such as 1.0.1."
}

$package = Get-Content -LiteralPath (Join-Path $repository "package.json") -Raw | ConvertFrom-Json
$currentVersion = [string]$package.version

$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  throw "Could not determine the current Git branch. Check out a branch before releasing."
}

$remote = & git remote get-url origin
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($remote | Out-String).Trim())) {
  throw "No Git remote named origin is configured."
}

$changes = & git status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw "Could not check the Git working tree."
}
if ($changes) {
  throw "Commit or stash all changes before running the release script."
}

$tag = "v$version"
$existingTag = & git tag --list $tag
if ($LASTEXITCODE -ne 0) {
  throw "Could not check whether tag $tag already exists."
}

$remoteTag = & git ls-remote --tags origin "refs/tags/$tag" "refs/tags/$tag^{}"
if ($LASTEXITCODE -ne 0) {
  throw "Could not check GitHub for tag $tag. Check your network connection and repository access."
}
if ($remoteTag) {
  throw "Release tag $tag already exists on GitHub. Choose a newer version."
}
if ($existingTag) {
  Write-Host "Local-only tag $tag found. It will be moved to the release commit."
}

$requiredPaths = @(
  "node_modules\.bin\tsc.cmd",
  "node_modules\.bin\electron-vite.cmd",
  "node_modules\.bin\electron-builder.cmd",
  "node_modules\electron\dist\electron.exe"
)
$missingPaths = @($requiredPaths | Where-Object { -not (Test-Path -LiteralPath (Join-Path $repository $_)) })
if ($missingPaths.Count -gt 0) {
  throw "Project dependencies are missing or incomplete. Close the app and development server, run 'npm install', then run build.bat again. Missing: $($missingPaths -join ', ')"
}

if ($version -eq $currentVersion) {
  Write-Host "Using package version $version for the release..."
} else {
  Write-Host "Updating package version..."
  Invoke-CheckedCommand "npm.cmd" @("version", $version, "--no-git-tag-version")
  Invoke-CheckedCommand "git.exe" @("add", "package.json", "package-lock.json")
  Invoke-CheckedCommand "git.exe" @("commit", "-m", "Release $tag")
}

Write-Host "Building the Windows app..."
Invoke-CheckedCommand "npm.cmd" @("run", "build")

Write-Host "Creating or updating local tag $tag..."
Invoke-CheckedCommand "git.exe" @("tag", "--force", $tag)

Write-Host "Pushing release commit and tag $tag..."
Invoke-CheckedCommand "git.exe" @("push", "origin", $branch)
Invoke-CheckedCommand "git.exe" @("push", "origin", $tag)

$secureToken = Read-Host "GitHub token (input is hidden)" -AsSecureString
if ($secureToken.Length -eq 0) {
  throw "A GitHub token is required to publish the release."
}

$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $env:GH_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
}

Write-Host "Publishing installer and updater metadata to GitHub Releases..."
try {
  Invoke-CheckedCommand "npx.cmd" @("electron-builder", "--win", "--publish", "always")
}
finally {
  Remove-Item Env:\GH_TOKEN -ErrorAction SilentlyContinue
  $secureToken.Dispose()
}
