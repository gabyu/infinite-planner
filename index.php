<?php

// Set upload and processed file paths
define("UPLOAD_DIR", "uploads/");
define("PROCESSED_DIR", "processed/");

// Ensure directories exist
if (!file_exists(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0777, true);
if (!file_exists(PROCESSED_DIR)) mkdir(PROCESSED_DIR, 0777, true);

// Handle file upload
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['kml_file'])) {
    $file = $_FILES['kml_file'];
    $filename = UPLOAD_DIR . basename($file['name']);
    
    if (move_uploaded_file($file['tmp_name'], $filename)) {
        $processedFile = processKML($filename);
        
        // Force download of the processed file
        header("Content-Description: File Transfer");
        header("Content-Type: application/vnd.google-earth.kml+xml");
        header("Content-Disposition: attachment; filename=processed.kml");
        header("Expires: 0");
        header("Cache-Control: must-revalidate");
        header("Pragma: public");
        header("Content-Length: " . filesize($processedFile));
        readfile($processedFile);
        exit;
    } else {
        echo "Error uploading file.";
    }
}

function processKML($filepath) {
    libxml_use_internal_errors(true);
    $xml = simplexml_load_file($filepath);
    if (!$xml) {
        die("Error parsing KML file.");
    }
    
    $waypoints = [];
    foreach ($xml->Document->Folder->Placemark as $placemark) {
        if (isset($placemark->Point->coordinates)) {
            $coords = explode(",", trim((string) $placemark->Point->coordinates));
            if (count($coords) >= 3) {
                $waypoints[] = [
                    "lon" => (float) $coords[0], 
                    "lat" => (float) $coords[1], 
                    "alt" => round((float) $coords[2] / 100) * 100
                ];
            }
        }
    }
    
    if (empty($waypoints)) {
        die("No waypoints found in the KML file.");
    }
    
    return generateKML(simplifyWaypoints($waypoints));
}

function simplifyWaypoints($waypoints, $maxWaypoints = 240) {
    $total = count($waypoints);
    if ($total <= $maxWaypoints) return $waypoints;
    
    $first = array_slice($waypoints, 0, 90);
    $last = array_slice($waypoints, -90);
    $cruise = array_slice($waypoints, 90, -90);
    
    $step = max(1, count($cruise) / ($maxWaypoints - count($first) - count($last)));
    $cruise = array_values(array_filter($cruise, function($key) use ($step) {
        return $key % ceil($step) === 0;
    }, ARRAY_FILTER_USE_KEY));
    
    return array_merge($first, $cruise, $last);
}

function generateKML($waypoints) {
    $kml = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document></Document></kml>');
    $document = $kml->Document;
    
    foreach ($waypoints as $i => $wp) {
        $placemark = $document->addChild('Placemark');
        $placemark->addChild('name', "G-" . ($i + 1));
        $point = $placemark->addChild('Point');
        $point->addChild('coordinates', "{$wp['lon']},{$wp['lat']},{$wp['alt']}");
    }
    
    $outputFile = PROCESSED_DIR . "processed.kml";
    $kml->asXML($outputFile);
    return $outputFile;
}

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Upload KML</title>
</head>
<body>
    <form action="" method="post" enctype="multipart/form-data">
        <input type="file" name="kml_file" accept=".kml" required>
        <button type="submit">Upload and Process</button>
    </form>
</body>
</html>
