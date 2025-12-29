#!/usr/bin/env pwsh

# MST PWA Icon Placeholder Creator
# Creates simple placeholder icons for testing

Write-Host "🎨 Creating placeholder icons for MST PWA..." -ForegroundColor Cyan

$sizes = @(72, 96, 128, 144, 152, 192, 384, 512)
$publicDir = "public"

# Create public directory if it doesn't exist
if (-not (Test-Path $publicDir)) {
    New-Item -ItemType Directory -Path $publicDir | Out-Null
}

# Create a simple SVG for each size
foreach ($size in $sizes) {
    $center = $size / 2
    $radius = $size / 3
    $fontSize = $size / 5
    
    $svg = @"
<svg width="$size" height="$size" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#a855f7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="$size" height="$size" fill="#020617"/>
  <circle cx="$center" cy="$center" r="$radius" fill="url(#grad)" opacity="0.8"/>
  <text x="50%" y="55%" text-anchor="middle" fill="white" font-size="$fontSize" font-family="Arial" font-weight="bold">MST</text>
</svg>
"@
    
    $filename = "$publicDir/icon-$size.svg"
    $svg | Out-File -FilePath $filename -Encoding UTF8
    
    Write-Host "  ✓ Created $filename" -ForegroundColor Green
}

# Create maskable versions
Copy-Item "$publicDir/icon-192.svg" "$publicDir/icon-maskable-192.svg"
Copy-Item "$publicDir/icon-512.svg" "$publicDir/icon-maskable-512.svg"

Write-Host ""
Write-Host "✅ All placeholder icons created!" -ForegroundColor Green
Write-Host ""

