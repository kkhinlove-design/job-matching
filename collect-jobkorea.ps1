# Jobkorea collector - runs on office PC (172.30.1.231)
$JOBKOREA_API_KEY  = "1389"
$SUPABASE_URL      = "https://sumcrvgloborridfsmdc.supabase.co"
$SUPABASE_ANON_KEY = "sb_publishable_9VGHIa0p1el9CNxFiIy7sQ_KxL06gWm"
$LOG_FILE          = "$PSScriptRoot\collect-log.txt"

function Write-Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $LOG_FILE -Value $line -Encoding UTF8
    Write-Host $line
}

try {
    Write-Log "START"
    $xmlUrl = "http://www.jobkorea.co.kr/Service_JK/Data/JK_GI_XML_List.asp?api=$JOBKOREA_API_KEY"
    $xmlResponse = Invoke-WebRequest -Uri $xmlUrl -UseBasicParsing -TimeoutSec 30 `
        -Headers @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    [xml]$xml = $xmlResponse.Content

    $now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $postings = @()

    foreach ($item in $xml.SelectNodes("//JK_GI")) {
        $giNo    = $item.GI_No
        $title   = $item.GI_Name
        $company = $item.Comp_Name
        if (-not $giNo -or -not $title -or -not $company) { continue }

        $salaryRaw    = $item.Pay_Min -replace ",", ""
        $salaryAmount = if ($salaryRaw -match "^\d+$") { [int]$salaryRaw } else { $null }
        $postUrl      = if ($item.GI_URL) { $item.GI_URL } else { "https://www.jobkorea.co.kr/Recruit/GI_Read/$giNo" }

        $posting = [ordered]@{
            source        = "jobkorea"
            external_id   = "jobkorea_$giNo"
            title         = $title
            company_name  = $company
            region        = "$($item.Work_Place)"
            job_type      = "$($item.Career)"
            job_code      = "$($item.Duty_Code)"
            salary_type   = "$($item.Pay_Type)"
            salary_amount = $salaryAmount
            deadline      = if ($item.End_Date) { "$($item.End_Date)" } else { $null }
            description   = if ($item.Work_Content) { "$($item.Work_Content)" } else { $null }
            url           = $postUrl
            closed        = $false
            collected_at  = $now
        }
        $postings += $posting
    }

    if ($postings.Count -eq 0) {
        Write-Log "ERROR: no postings parsed - check XML structure"
        exit 1
    }

    Write-Log "PARSED: $($postings.Count) postings"

    $headers = @{
        "apikey"        = $SUPABASE_ANON_KEY
        "Authorization" = "Bearer $SUPABASE_ANON_KEY"
        "Content-Type"  = "application/json"
        "Prefer"        = "resolution=merge-duplicates"
    }

    $saved = 0
    $chunkSize = 500
    for ($i = 0; $i -lt $postings.Count; $i += $chunkSize) {
        $end  = [Math]::Min($i + $chunkSize - 1, $postings.Count - 1)
        $body = $postings[$i..$end] | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/job_postings" -Method POST -Headers $headers -Body $body | Out-Null
        $saved += ($end - $i + 1)
    }

    Write-Log "DONE: $saved postings saved"

} catch {
    Write-Log "ERROR: $_"
    exit 1
}
