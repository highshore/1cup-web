// Geocoding service for resolving coordinates from location data

import { naverMapsScriptSrc } from "../../../constants/naver_maps";

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

// Load Naver Maps API if not already loaded
const loadNaverMapsAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if API is already loaded
    if (window.naver && window.naver.maps && window.naver.maps.Service) {
      resolve();
      return;
    }

    // Set up global callback
    (window as any).initNaverMapsGeocode = () => {
      if (window.naver && window.naver.maps && window.naver.maps.Service) {
        resolve();
      } else {
        reject(new Error('Naver Maps API loaded but Service not available'));
      }
    };

    // Check if script is already loading
    const existingScript = document.querySelector('script[src*="oapi.map.naver.com"]');
    if (existingScript) {
      // Wait for existing script to load
      const checkTimer = setInterval(() => {
        if (window.naver && window.naver.maps && window.naver.maps.Service) {
          clearInterval(checkTimer);
          resolve();
        }
      }, 500);
      
      setTimeout(() => {
        clearInterval(checkTimer);
        reject(new Error('Timeout waiting for Naver Maps API'));
      }, 10000);
      
      return;
    }

    // Create and inject script tag
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = naverMapsScriptSrc('initNaverMapsGeocode');
    script.async = true;
    script.defer = true;
    
    script.onerror = () => {
      reject(new Error('Failed to load Naver Maps API'));
    };

    document.head.appendChild(script);
  });
};

// Extract coordinates from Naver Maps URL
const extractCoordsFromMapUrl = (url: string): GeocodeResult | null => {
  try {
    const urlObj = new URL(url);
    
    // Check for lat/lng parameters
    const lat = urlObj.searchParams.get('lat') || urlObj.searchParams.get('latitude');
    const lng = urlObj.searchParams.get('lng') || urlObj.searchParams.get('longitude');
    
    if (lat && lng) {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        return { latitude: parsedLat, longitude: parsedLng };
      }
    }

    // Check for coordinates in hash or other formats
    const hash = urlObj.hash;
    const coordMatch = hash.match(/(\d+\.\d+),(\d+\.\d+)/);
    if (coordMatch) {
      const parsedLat = parseFloat(coordMatch[1]);
      const parsedLng = parseFloat(coordMatch[2]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        return { latitude: parsedLat, longitude: parsedLng };
      }
    }

  } catch (error) {
    console.warn('Failed to extract coordinates from URL:', error);
  }
  
  return null;
};

// Geocode address using Naver API
const geocodeWithNaver = (address: string): Promise<GeocodeResult> => {
  return new Promise((resolve, reject) => {
    if (!window.naver?.maps?.Service) {
      reject(new Error('Naver Maps Service not available'));
      return;
    }

    window.naver.maps.Service.geocode({
      query: address
    }, (status: any, response: any) => {
      if (status === window.naver.maps.Service.Status.ERROR) {
        reject(new Error('Geocoding API error'));
        return;
      }

      if (response.v2?.meta?.totalCount > 0) {
        const result = response.v2.addresses[0];
        const lat = parseFloat(result.y);
        const lng = parseFloat(result.x);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          resolve({ latitude: lat, longitude: lng });
          return;
        }
      }
      
      reject(new Error('No geocoding results found'));
    });
  });
};

// Main geocoding function that tries multiple methods
export const geocodeLocation = async (
  locationName: string,
  locationAddress?: string,
  mapUrl?: string
): Promise<GeocodeResult> => {
  try {
    // 1. Try to extract coordinates from mapUrl first
    if (mapUrl) {
      const coords = extractCoordsFromMapUrl(mapUrl);
      if (coords) {
        console.log('Coordinates extracted from map URL:', coords);
        return coords;
      }
    }

    // 2. Load Naver Maps API if needed
    await loadNaverMapsAPI();

    // 3. Try geocoding with address first (more specific)
    if (locationAddress) {
      try {
        const coords = await geocodeWithNaver(locationAddress);
        console.log('Coordinates resolved from address:', coords);
        return coords;
      } catch (error) {
        console.warn('Address geocoding failed, trying location name:', error);
      }
    }

    // 4. Try geocoding with location name
    if (locationName) {
      try {
        const coords = await geocodeWithNaver(locationName);
        console.log('Coordinates resolved from location name:', coords);
        return coords;
      } catch (error) {
        console.warn('Location name geocoding failed:', error);
      }
    }

    // 5. Fallback to Seoul coordinates
    console.warn('All geocoding methods failed, using Seoul coordinates');
    return { latitude: 37.5665, longitude: 126.9780 };

  } catch (error) {
    console.error('Geocoding service error:', error);
    // Return Seoul coordinates as ultimate fallback
    return { latitude: 37.5665, longitude: 126.9780 };
  }
}; 