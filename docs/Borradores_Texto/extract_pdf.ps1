# Copy PDF first to avoid lock issues
$pdf = Get-ChildItem 'C:\Users\c_car\Desktop\*Entrega 3*'
$copy = 'C:\Users\c_car\Desktop\consigna3_copy.pdf'
Copy-Item $pdf.FullName $copy -Force

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
    # Open PDF in Word (converts to editable doc)
    $doc = $word.Documents.Open($copy, $false, $true, $false, "", "", $false, "", "", 0)
    Start-Sleep -Seconds 5
    $text = $doc.Content.Text
    $text | Out-File 'C:\Users\c_car\Desktop\consigna3.txt' -Encoding UTF8
    Write-Host "OK: $($text.Length) chars extracted"
    $doc.Close($false)
} catch {
    Write-Host "Error: $_"
} finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    Remove-Item $copy -Force -ErrorAction SilentlyContinue
}
