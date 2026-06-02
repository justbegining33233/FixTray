$files = Get-ChildItem -Path "C:\FixTray\src" -Recurse -Filter "*.tsx"
$count = 0
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName)
    if ($c.Contains('}}">')) {
        [System.IO.File]::WriteAllText($f.FullName, $c.Replace('}}">','}}>' ))
        $count++
        Write-Host "Fixed }}`: $($f.Name)"
    }
}

# Also fix the split className patterns: style={{...}} someClasses">
# Pattern: }} followed by space and Tailwind classes then ">
$files2 = Get-ChildItem -Path "C:\FixTray\src" -Recurse -Filter "*.tsx"
foreach ($f in $files2) {
    $c = [System.IO.File]::ReadAllText($f.FullName)
    # Match: style={...}} classnames">  where classnames is a word boundary
    if ($c -match '\}\} [a-z][a-z-]+ [a-z][a-z-]') {
        Write-Host "Potential split-className in: $($f.Name) - manual review needed"
    }
}

Write-Host "Total }}` fixed: $count files"
