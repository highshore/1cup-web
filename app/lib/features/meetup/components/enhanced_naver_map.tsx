import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';

// TypeScript declarations for Naver Maps
declare global {
  interface Window {
    naver: any;
    initNaverMaps?: () => void;
    navermap_authFailure?: () => void;
  }
}

interface EnhancedNaverMapProps {
  // Location can be provided in multiple ways
  latitude?: number;
  longitude?: number;
  locationName: string;
  locationAddress?: string;
  mapUrl?: string;
  zoom?: number;
}

const MapContainer = styled.div`
  height: 300px;
  border-radius: 12px;
  margin: 1rem 0;
  border: 1px solid #e0e0e0;
  overflow: hidden;
  cursor: pointer;
  position: relative;
  
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const MapLoadingPlaceholder = styled.div`
  height: 300px;
  background-color: #f5f5f5;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 1rem;
  margin: 1rem 0;
  border: 1px solid #e0e0e0;
`;

const EnhancedNaverMapComponent: React.FC<EnhancedNaverMapProps> = ({ 
  latitude, 
  longitude, 
  locationName, 
  locationAddress,
  mapUrl,
  zoom = 16
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [componentMounted, setComponentMounted] = useState(false);
  const [resolvedCoordinates, setResolvedCoordinates] = useState<{lat: number, lng: number} | null>(null);

  // Ensure component is mounted before trying to access DOM
  useEffect(() => {
    const timer = setTimeout(() => {
      setComponentMounted(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Load Naver Maps API
  useEffect(() => {
    const loadNaverMapsAPI = () => {
      if (window.naver && window.naver.maps && typeof window.naver.maps.Map === 'function') {
        setIsApiReady(true);
        return;
      }

      window.initNaverMaps = () => {
        setIsApiReady(true);
      };

      window.navermap_authFailure = () => {
        setLoadError('Naver Maps API Authentication Failed');
      };

      const existingScript = document.querySelector('script[src*="oapi.map.naver.com"]');
      if (existingScript) {
        const checkTimer = setInterval(() => {
          if (window.naver && window.naver.maps && typeof window.naver.maps.Map === 'function') {
            setIsApiReady(true);
            clearInterval(checkTimer);
          }
        }, 500);
        
        setTimeout(() => {
          clearInterval(checkTimer);
          if (!window.naver || !window.naver.maps) {
            setLoadError('Timeout loading Naver Maps API');
          }
        }, 10000);
        
        return;
      }

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=3cyz9x5q6l&submodules=geocoder&callback=initNaverMaps';
      script.async = true;
      script.defer = true;
      
      script.onerror = () => {
        setLoadError('Failed to load Naver Maps API');
      };

      document.head.appendChild(script);
    };

    loadNaverMapsAPI();

    return () => {
      delete window.initNaverMaps;
      delete window.navermap_authFailure;
    };
  }, []);

  // Resolve coordinates from various sources
  useEffect(() => {
    if (!isApiReady || !componentMounted) return;

    const resolveCoordinates = async () => {
      try {
        // 1. Use provided coordinates if available
        if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
          setResolvedCoordinates({ lat: latitude, lng: longitude });
          return;
        }

        // 2. Try to extract coordinates from mapUrl
        if (mapUrl) {
          const coords = extractCoordsFromMapUrl(mapUrl);
          if (coords) {
            setResolvedCoordinates(coords);
            return;
          }
        }

        // 3. Use Naver Geocoder API if available
        if (window.naver?.maps?.Service) {
          const searchAddress = locationAddress || locationName;
          if (searchAddress) {
            try {
              await geocodeAddress(searchAddress);
              return;
            } catch (error) {
              console.warn('Geocoding failed:', error);
            }
          }
        }

        // 4. Fallback to default Seoul coordinates
        console.warn('Using default coordinates (Seoul)');
        setResolvedCoordinates({ lat: 37.5665, lng: 126.9780 });

      } catch (error) {
        console.error('Error resolving coordinates:', error);
        setResolvedCoordinates({ lat: 37.5665, lng: 126.9780 });
      }
    };

    resolveCoordinates();
  }, [isApiReady, componentMounted, latitude, longitude, locationAddress, locationName, mapUrl]);

  // Extract coordinates from Naver Maps URL
  const extractCoordsFromMapUrl = (url: string): {lat: number, lng: number} | null => {
    try {
      // Naver Maps URLs often contain coordinates in various formats
      // Example: https://map.naver.com/v5/search/address?c=14.00,0,0,0,dh&lat=37.5665&lng=126.9780
      const urlObj = new URL(url);
      
      // Check for lat/lng parameters
      const lat = urlObj.searchParams.get('lat') || urlObj.searchParams.get('latitude');
      const lng = urlObj.searchParams.get('lng') || urlObj.searchParams.get('longitude');
      
      if (lat && lng) {
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          return { lat: parsedLat, lng: parsedLng };
        }
      }

      // Check for coordinates in hash or other formats
      const hash = urlObj.hash;
      const coordMatch = hash.match(/(\d+\.\d+),(\d+\.\d+)/);
      if (coordMatch) {
        const parsedLat = parseFloat(coordMatch[1]);
        const parsedLng = parseFloat(coordMatch[2]);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          return { lat: parsedLat, lng: parsedLng };
        }
      }

    } catch (error) {
      console.warn('Failed to extract coordinates from URL:', error);
    }
    
    return null;
  };

  // Geocode address using Naver API
  const geocodeAddress = (address: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!window.naver?.maps?.Service) {
        reject(new Error('Naver Maps Service not available'));
        return;
      }

      window.naver.maps.Service.geocode({
        query: address
      }, (status: any, response: any) => {
        if (status === window.naver.maps.Service.Status.ERROR) {
          reject(new Error('Geocoding error'));
          return;
        }

        if (response.v2?.meta?.totalCount > 0) {
          const result = response.v2.addresses[0];
          const lat = parseFloat(result.y);
          const lng = parseFloat(result.x);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            setResolvedCoordinates({ lat, lng });
            resolve();
            return;
          }
        }
        
        reject(new Error('No geocoding results'));
      });
    });
  };

  // Initialize map once coordinates are resolved
  useEffect(() => {
    if (!isApiReady || !mapRef.current || loadError || !componentMounted || !resolvedCoordinates) {
      return;
    }

    try {
      const position = new window.naver.maps.LatLng(resolvedCoordinates.lat, resolvedCoordinates.lng);
      
      const mapOptions = {
        center: position,
        zoom: zoom,
        minZoom: 10,
        maxZoom: 20,
        mapTypeControl: false,
        scaleControl: false,
        logoControl: false,
        mapDataControl: false,
      };

      const map = new window.naver.maps.Map(mapRef.current, mapOptions);

      // Create marker
      const marker = new window.naver.maps.Marker({
        position: position,
        map: map,
        title: locationName,
        icon: {
          content: `
            <div style="
              width: 30px; 
              height: 30px; 
              background-color: #181818; 
              border-radius: 50%; 
              display: flex; 
              align-items: center; 
              justify-content: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              cursor: pointer;
            ">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: white; display: block;"></span>
            </div>
          `,
          size: new window.naver.maps.Size(30, 30),
          anchor: new window.naver.maps.Point(15, 15),
        }
      });

      // Add click event handlers
      const handleMapClick = () => {
        if (mapUrl) {
          window.open(mapUrl, '_blank');
        } else {
          const searchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(locationName)}`;
          window.open(searchUrl, '_blank');
        }
      };

      if (window.naver.maps.Event) {
        window.naver.maps.Event.addListener(marker, 'click', handleMapClick);
        window.naver.maps.Event.addListener(map, 'click', handleMapClick);
      }

      setMapLoaded(true);
    } catch (error) {
      console.error('Error initializing map:', error);
      setLoadError(`Error initializing map: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [isApiReady, resolvedCoordinates, locationName, mapUrl, zoom, loadError, componentMounted]);

  if (loadError) {
    return (
      <MapLoadingPlaceholder>
        {loadError}
      </MapLoadingPlaceholder>
    );
  }

  if (!isApiReady) {
    return (
      <MapLoadingPlaceholder>
        Loading Naver Maps API...
      </MapLoadingPlaceholder>
    );
  }

  if (!resolvedCoordinates) {
    return (
      <MapLoadingPlaceholder>
        Resolving location...
      </MapLoadingPlaceholder>
    );
  }

  return (
    <MapContainer ref={mapRef}>
      {!mapLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          color: '#999',
          fontSize: '1rem',
          borderRadius: '12px',
          zIndex: 10
        }}>
          Initializing map...
        </div>
      )}
    </MapContainer>
  );
};

export default EnhancedNaverMapComponent;
