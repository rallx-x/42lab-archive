<#
42LAB 아이템 아이콘 추리기 (2026-11-05)

AssetStudio 로 중국 서버 클라이언트 그림을 PNG 로 뽑은 폴더에서
목록(item_icons_needed.txt)에 있는 아이콘만 골라 한 폴더에 모읍니다.

  - 파일 이름은 게임 아이콘 이름 그대로 (예: ICON_Item_3100.png / .webp)
  - AssetStudio 가 같은 이름에 붙이는 " #1234" 같은 꼬리는 떼고, 같은 이름이 여러 개면 가장 큰 파일을 씀
  - ICON_Item_31 과 ICON_Item_3100 처럼 앞부분이 같은 이름은 섞이지 않음 (이름 전체가 같아야 함)
  - cwebp(구글 WebP 도구)가 있으면 -Webp 로 webp 변환 + 크기 줄이기
  - 못 찾은 이름은 _missing.txt 로 남김

사용 예 (PowerShell):
  powershell -ExecutionPolicy Bypass -File .\pick_item_icons.ps1 `
     -Source "D:\AssetStudio\Export" -List ".\item_icons_needed.txt" -Out "D:\42lab-item"

  webp 로 (cwebp.exe 가 PATH 에 있거나 -Cwebp 로 위치 지정):
  powershell -ExecutionPolicy Bypass -File .\pick_item_icons.ps1 `
     -Source "D:\AssetStudio\Export" -List ".\item_icons_needed.txt" -Out "D:\42lab-item" -Webp -Size 128

  선물 24장만 (목록 파일의 「## 1.」 칸만):
     ... -Section 1
#>
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$List,
  [Parameter(Mandatory = $true)][string]$Out,
  [switch]$Webp,
  [int]$Size = 128,
  [int]$Quality = 90,
  [string]$Cwebp = "cwebp",
  [int]$Section = 0
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not (Test-Path -LiteralPath $Source)) { throw "Source 폴더가 없어요: $Source" }
if (-not (Test-Path -LiteralPath $List))   { throw "목록 파일이 없어요: $List" }
New-Item -ItemType Directory -Force -Path $Out | Out-Null

# 1) 목록 읽기 (# 로 시작하는 줄 = 제목, 「## 1.」 「## 2.」 … = 칸 번호)
$names = New-Object System.Collections.Generic.List[string]
$cur = 0
foreach ($line in Get-Content -LiteralPath $List -Encoding UTF8) {
  $t = $line.Trim()
  if ($t -match '^##\s*(\d+)\.') { $cur = [int]$Matches[1]; continue }
  if ($t -eq '' -or $t.StartsWith('#')) { continue }
  if ($Section -eq 0 -or $Section -eq $cur) { if (-not $names.Contains($t)) { $names.Add($t) } }
}
Write-Host ("찾을 아이콘: {0}개" -f $names.Count)

# 2) 뽑은 그림 전체를 한 번만 훑어서 「이름 → 가장 큰 파일」 표 만들기
$want = @{}
foreach ($n in $names) { $want[$n.ToLowerInvariant()] = $n }
$found = @{}
$files = Get-ChildItem -LiteralPath $Source -Recurse -File -Filter *.png
Write-Host ("훑은 PNG: {0}개" -f $files.Count)
foreach ($f in $files) {
  # AssetStudio 꼬리 떼기: "ICON_Item_3100 #12345" / "ICON_Item_3100_#12345"
  $base = $f.BaseName -replace '[ _]#\d+$', ''
  $key = $base.ToLowerInvariant()
  if (-not $want.ContainsKey($key)) { continue }
  if (-not $found.ContainsKey($key) -or $f.Length -gt $found[$key].Length) { $found[$key] = $f }
}

# 3) 복사 (또는 webp 변환)
if ($Webp) {
  $cw = Get-Command $Cwebp -ErrorAction SilentlyContinue
  if (-not $cw) { throw "cwebp 를 찾을 수 없어요. https://developers.google.com/speed/webp/download 에서 받아 -Cwebp 로 위치를 알려 주세요." }
}
$ok = 0
foreach ($n in $names) {
  $key = $n.ToLowerInvariant()
  if (-not $found.ContainsKey($key)) { continue }
  $src = $found[$key].FullName
  if ($Webp) {
    $dst = Join-Path $Out ($n + '.webp')
    & $cw.Source -quiet -q $Quality -resize $Size 0 -alpha_q 100 $src -o $dst
    if ($LASTEXITCODE -ne 0) { Write-Warning "변환 실패: $n"; continue }
  } else {
    $dst = Join-Path $Out ($n + '.png')
    Copy-Item -LiteralPath $src -Destination $dst -Force
  }
  $ok++
}

# 4) 못 찾은 것
$missing = @($names | Where-Object { -not $found.ContainsKey($_.ToLowerInvariant()) })
$missPath = Join-Path $Out '_missing.txt'
if ($missing.Count) { $missing | Set-Content -LiteralPath $missPath -Encoding UTF8 }
elseif (Test-Path -LiteralPath $missPath) { Remove-Item -LiteralPath $missPath }

Write-Host ""
Write-Host ("완료: {0}개 저장 → {1}" -f $ok, $Out)
if ($missing.Count) { Write-Host ("못 찾음: {0}개 (목록: {1})" -f $missing.Count, $missPath) -ForegroundColor Yellow }
