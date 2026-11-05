<#
42LAB 뉴럴 클라우드 .ab 파일 앞머리 고치기 (2026-11-05)

뉴럴 클라우드 .ab 파일은 맨 앞에 0 바이트 8개가 붙어 있어서
AssetStudio 가 Unity 파일로 알아보지 못합니다.
앞 8바이트를 뗀 사본을 다른 폴더에 같은 구조로 만듭니다. (원본은 건드리지 않음)

  - 「0 x8 + UnityFS」 로 시작하는 파일만 고침, 이미 UnityFS 로 시작하면 그대로 복사, 그 외는 건너뜀

사용 예:
  powershell -ExecutionPolicy Bypass -File .\fix_ab_header.ps1 -Source "D:\pnc\cn_raw" -Out "D:\pnc\cn_ab"
#>
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Out
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
if (-not (Test-Path -LiteralPath $Source)) { throw "Source 폴더가 없어요: $Source" }
$src = (Resolve-Path -LiteralPath $Source).Path.TrimEnd('\', '/')
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$sig = [System.Text.Encoding]::ASCII.GetBytes('UnityFS')

$fixed = 0; $copied = 0; $skipped = 0
foreach ($f in Get-ChildItem -LiteralPath $src -Recurse -File) {
  $head = New-Object byte[] 16
  $fs = [System.IO.File]::OpenRead($f.FullName)
  try { $n = $fs.Read($head, 0, 16) } finally { $fs.Close() }
  if ($n -lt 15) { $skipped++; continue }

  $offset = -1
  $zeros = $true; for ($i = 0; $i -lt 8; $i++) { if ($head[$i] -ne 0) { $zeros = $false; break } }
  $at8 = $true; for ($i = 0; $i -lt 7; $i++) { if ($head[8 + $i] -ne $sig[$i]) { $at8 = $false; break } }
  $at0 = $true; for ($i = 0; $i -lt 7; $i++) { if ($head[$i] -ne $sig[$i]) { $at0 = $false; break } }
  if ($zeros -and $at8) { $offset = 8 } elseif ($at0) { $offset = 0 } else { $skipped++; continue }

  $rel = $f.FullName.Substring($src.Length).TrimStart('\', '/')
  $dst = Join-Path $Out $rel
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
  $in = [System.IO.File]::OpenRead($f.FullName)
  $outS = [System.IO.File]::Create($dst)
  try { [void]$in.Seek($offset, 'Begin'); $in.CopyTo($outS) } finally { $in.Close(); $outS.Close() }
  if ($offset -eq 8) { $fixed++ } else { $copied++ }
}
Write-Host ("고침: {0}개 · 그대로 복사: {1}개 · Unity 파일 아님(건너뜀): {2}개" -f $fixed, $copied, $skipped)
Write-Host ("결과 폴더: {0}  ← AssetStudio 에서 이 폴더를 여세요" -f $Out)
