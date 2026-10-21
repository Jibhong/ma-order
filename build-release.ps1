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

function Invoke-GitHubApi {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Uri,
    [object]$Body
  )

  $headers = @{
    Authorization = "Bearer $githubToken"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent" = "ma-order-release-script"
  }
  if ($PSBoundParameters.ContainsKey("Body")) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers `
      -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10)
  }
  Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
}

function Get-GitHubReleases {
  $releases = @()
  $page = 1
  do {
    $pageReleases = @(Invoke-GitHubApi "Get" "https://api.github.com/repos/Jibhong/ma-order/releases?per_page=100&page=$page")
    $releases += $pageReleases
    $page++
  } while ($pageReleases.Count -eq 100)
  return $releases
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
  if ($version -ne $currentVersion) {
    throw "Release tag $tag already exists on GitHub. Choose a newer version."
  }
  $tagLine = $remoteTag | Where-Object { $_ -match '\srefs/tags/.+\^\{\}$' } | Select-Object -First 1
  if (-not $tagLine) {
    $tagLine = $remoteTag | Select-Object -First 1
  }
  $remoteTagCommit = ($tagLine -split '\s+')[0]
  $headCommit = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $remoteTagCommit -ne $headCommit) {
    throw "Release tag $tag already exists on a different commit. Choose a newer version."
  }
  Write-Host "Release tag $tag already points to this commit. The release assets will be refreshed."
}
if ($existingTag -and -not $remoteTag) {
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

$secureToken = Read-Host "GitHub token (input is hidden)" -AsSecureString
if ($secureToken.Length -eq 0) {
  throw "A GitHub token is required to publish the release."
}

$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
  $githubToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
}

$previousGhToken = $env:GH_TOKEN
$previousIgnoreTime = $env:EP_GH_IGNORE_TIME
try {
  $env:GH_TOKEN = $githubToken
  $env:EP_GH_IGNORE_TIME = "true"
  Invoke-GitHubApi "Get" "https://api.github.com/repos/Jibhong/ma-order/releases?per_page=1" | Out-Null

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

Write-Host "Pushing release commit..."
Invoke-CheckedCommand "git.exe" @("push", "origin", $branch)
if (-not $remoteTag) {
  Write-Host "Pushing release tag $tag..."
  Invoke-CheckedCommand "git.exe" @("push", "origin", $tag)
}

Write-Host "Publishing installer and updater metadata to GitHub Releases..."
$env:GH_TOKEN = $githubToken
Invoke-CheckedCommand "npx.cmd" @("electron-builder", "--win", "--publish", "always")

$matchingReleases = @(
  Get-GitHubReleases | Where-Object { $_.tag_name -eq $tag -or $_.tag_name -eq $version }
)
$completeReleases = @(
  $matchingReleases | Where-Object {
    $assets = @($_.assets | ForEach-Object { $_.name })
    ($assets -contains "latest.yml") -and
    (@($assets | Where-Object { $_ -match '-setup\.exe$' }).Count -gt 0)
  } | Sort-Object -Property @{ Expression = { [DateTime]$_.created_at }; Descending = $true }
)

if ($completeReleases.Count -eq 0) {
  throw "Release $tag does not contain both latest.yml and a Windows setup installer. No duplicate releases were removed."
}

$releaseToKeep = $completeReleases[0]
if ($releaseToKeep.draft) {
  Write-Host "Publishing the complete draft release..."
  Invoke-GitHubApi "Patch" "https://api.github.com/repos/Jibhong/ma-order/releases/$($releaseToKeep.id)" @{
    draft = $false
  } | Out-Null
}
Write-Host "Keeping GitHub release $($releaseToKeep.html_url) with its installer and latest.yml."
foreach ($release in $matchingReleases) {
  if ($release.id -ne $releaseToKeep.id) {
    Write-Host "Removing duplicate GitHub release $($release.html_url)..."
    Invoke-GitHubApi "Delete" "https://api.github.com/repos/Jibhong/ma-order/releases/$($release.id)"
  }
}
}
finally {
  if ($null -eq $previousGhToken) {
    Remove-Item Env:\GH_TOKEN -ErrorAction SilentlyContinue
  } else {
    $env:GH_TOKEN = $previousGhToken
  }
  if ($null -eq $previousIgnoreTime) {
    Remove-Item Env:\EP_GH_IGNORE_TIME -ErrorAction SilentlyContinue
  } else {
    $env:EP_GH_IGNORE_TIME = $previousIgnoreTime
  }
  $githubToken = $null
  $secureToken.Dispose()
}
