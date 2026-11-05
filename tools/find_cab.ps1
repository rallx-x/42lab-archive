# 번들 이름(CAB-…)으로 실제 .ab 파일 찾기 (2026-11-05)
# 사용: powershell -ExecutionPolicy Bypass -File find_cab.ps1
# 무장각인 화면(ui_armainscripta.ab)이 그림을 빌려오는 번들들
$want = @{
  '910c7f69f6bd05936bc26cdc2dfd0c03' = '틀 그림 1 (56곳)'
  'cd22116aa9c272d71ccee2d70bd1df0d' = '틀 그림 2 (40곳)'
  '4c9d1e1f9ce1fdac5d3c1c4b0e37a0b6' = '그림 3'
  '560a433e3a3f8a0f5298a1e67edc6e9f' = '그림 4'
  'eb09b7b2dca133cabb12a8fef400f523' = '그림 5'
  'e387b159dac118e212428f28f5217822' = '그림 6'
  'ab7c6212870d13f751da73ba79146015' = '그림 7'
  'c7fe3775c9256d64e4378907837bc346' = '그림 8'
  '61b15b8f63b50f178ff55c9824364481' = '기타'
  '74cdb792e88b457996180e1331c5ecda' = '기타'
  '9a2881f2d87a541e590ac2cc2a201c0f' = '기타'
}
$root = 'D:\pnc\client\cn\ab\bundles'
$enc = [Text.Encoding]::GetEncoding(28591)
$buf = New-Object byte[] 4096
Get-ChildItem $root -Recurse -File -Filter *.ab | ForEach-Object {
  $fs = [IO.File]::OpenRead($_.FullName)
  try { $n = $fs.Read($buf, 0, $buf.Length) } finally { $fs.Close() }
  $head = $enc.GetString($buf, 0, $n)
  foreach ($m in [regex]::Matches($head, 'CAB-([0-9a-f]{32})')) {
    $id = $m.Groups[1].Value
    if ($want.ContainsKey($id)) {
      [pscustomobject]@{ What = $want[$id]; KB = [int]($_.Length / 1KB); File = $_.FullName.Substring($root.Length + 1) }
      break
    }
  }
} | Sort-Object What | Format-Table -AutoSize | Out-String -Width 220
