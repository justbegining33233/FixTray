$files = Get-ChildItem -Path "C:\FixTray\src" -Recurse -Filter "*.tsx"
$count = 0
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName)
    $new = [regex]::Replace($c, '(\}\})"(\r?\n)', '$1$2')
    if ($new -ne $c) {
        [System.IO.File]::WriteAllText($f.FullName, $new)
        $count++
        Write-Host "Fixed end-of-line stray quote: $($f.Name)"
    }
}
Write-Host "Total files fixed: $count"
