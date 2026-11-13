$ErrorActionPreference = "Stop"

$baseUrl = "https://topupwizard.com/api"
$networks = @("mtn", "airtel", "glo", "9mobile")
$dataTypes = @("sme", "cg", "direct")

$secureToken = Read-Host "Enter TopupWizard API token" -AsSecureString
$credential = [System.Net.NetworkCredential]::new("", $secureToken)
$plainToken = $credential.Password

$headers = @{
    "Authorization-Token" = $plainToken
    "Accept" = "application/json"
    "Content-Type" = "application/json"
}

$results = [System.Collections.Generic.List[object]]::new()

try {
    $balance = Invoke-RestMethod -Uri "$baseUrl/balance" -Method Get -Headers $headers
    Write-Host "`nProvider balance: $($balance.data.funds)" -ForegroundColor Green

    foreach ($network in $networks) {
        Write-Host "`n========== $($network.ToUpper()) ==========" -ForegroundColor Cyan

        $requests = @(
            @{ type = "airtime"; typeSingle = $network }
        )

        foreach ($dataType in $dataTypes) {
            $requests += @{
                type = "data"
                typeSingle = $network
                dataType = $dataType
            }
        }

        foreach ($body in $requests) {
            $label = if ($body.type -eq "airtime") {
                "AIRTIME"
            } else {
                "DATA - $($body.dataType.ToUpper())"
            }

            Write-Host "`n--- $label ---" -ForegroundColor Yellow

            try {
                $response = Invoke-RestMethod `
                    -Uri "$baseUrl/pricing" `
                    -Method Post `
                    -Headers $headers `
                    -Body ($body | ConvertTo-Json -Compress)

                if ($response.status -ne "success") {
                    Write-Warning $response.message
                    continue
                }

                foreach ($item in @($response.data)) {
                    $entry = [PSCustomObject]@{
                        network = $item.network
                        type = $item.type
                        dataType = $item.dataType
                        serviceID = $item.serviceID
                        description = $item.description
                        amount = $item.amount
                        discount = $item.discount
                        isActive = $item.isActive
                        channel = $item.channel
                    }

                    $results.Add($entry)

                    Write-Host "$($entry.serviceID) | $($entry.description) | $($entry.amount) | Active: $($entry.isActive)"
                }
            }
            catch {
                Write-Warning "Lookup failed: $($_.Exception.Message)"
            }
        }
    }

    $output = Join-Path (Get-Location) "topupwizard-catalog.json"
    $results | ConvertTo-Json -Depth 10 | Set-Content -Path $output -Encoding utf8

    Write-Host "`nCatalog inspection completed." -ForegroundColor Green
    Write-Host "Total services: $($results.Count)"
    Write-Host "Saved to: $output"
}
finally {
    $plainToken = $null
    $credential = $null
    $secureToken = $null
    $headers = $null
}