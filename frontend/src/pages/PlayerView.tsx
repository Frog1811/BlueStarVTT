import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getActiveMap, getMapUrl, type Map } from '../api';
import GridOverlay from '../components/GridOverlay/GridOverlay';
import MapTokenLayer from '../components/MapTokenLayer/MapTokenLayer';
import InitiativeTracker from '../components/InitiativeTracker/InitiativeTracker';
import type { TokenUpdateEvent } from '../hooks/usePresence';

interface PlayerViewProps {
  sortedUsers: Array<{
    id: string;
    name: string;
    role: 'dm' | 'player';
    lastSeen: number;
  }>;
  connected: boolean;
  tokenUpdate: TokenUpdateEvent | null;
}

function PlayerView({ sortedUsers, connected, tokenUpdate }: PlayerViewProps) {
  const { sessionID } = useParams();
  const [activeMap, setActiveMap] = useState<Map | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fitToScreenZoom, setFitToScreenZoom] = useState(1); // Calculate based on image size
  const contentRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);


  // Load active map and poll for changes
  useEffect(() => {
    if (!sessionID) return;

    const loadActiveMap = async () => {
      try {
        const result = await getActiveMap(sessionID);
        // Preserve natural dimensions if we already have them for the same map
        setActiveMap(prevMap => {
          if (prevMap && result.map && result.map.id === prevMap.id) {
            // Same map - keep the corrected dimensions
            return {
              ...result.map,
              width: prevMap.width,
              height: prevMap.height
            };
          }
          // Different map or first load - use new dimensions (will be corrected by onLoad)
          return result.map;
        });
      } catch (error) {
      }
    };

    loadActiveMap();

    // Poll for map changes every 3 seconds
    const interval = setInterval(loadActiveMap, 3000);

    return () => clearInterval(interval);
  }, [sessionID]);

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!contentRef.current) return;

    e.preventDefault();

    const container = contentRef.current;

    // Get the full dimensions of the container where the map is rendered
    const containerRect = container.getBoundingClientRect();

    // Get mouse position relative to the container
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    // Calculate zoom direction
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    const minZoom = Math.min(fitToScreenZoom * 0.5, 0.05);
    const newZoom = Math.max(minZoom, Math.min(5, zoom * zoomDelta));

    // The transform is applied to the zoom container as: translate(panX, panY) scale(zoom) from origin (0,0)
    //
    // To find what map content is under the cursor:
    // Position in viewport = Position in map * zoom + pan
    // Position in map = (Position in viewport - pan) / zoom

    const mapX = (mouseX - panX) / zoom;
    const mapY = (mouseY - panY) / zoom;

    // After zooming, we want the same map position to stay under the cursor
    // newPan = mousePosition - (mapPosition * newZoom)

    const newPanX = mouseX - mapX * newZoom;
    const newPanY = mouseY - mapY * newZoom;

    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  }, [zoom, panX, panY, fitToScreenZoom]);

  // Handle panning with mouse drag (always enabled, not just when zoomed)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const newPanX = e.clientX - dragStart.x;
    const newPanY = e.clientY - dragStart.y;

    setPanX(newPanX);
    setPanY(newPanY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Calculate fit-to-screen zoom when image loads
  const handleImageLoad = () => {
    if (!imageRef.current || !contentRef.current || !activeMap) return;

    const img = imageRef.current;
    const container = contentRef.current;

    const imageWidth = img.naturalWidth;
    const imageHeight = img.naturalHeight;

    // Update activeMap with actual image dimensions if they differ
    if (imageWidth !== activeMap.width || imageHeight !== activeMap.height) {
      setActiveMap({
        ...activeMap,
        width: imageWidth,
        height: imageHeight
      });
    }

    // Use getBoundingClientRect for more accurate dimensions
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    if (imageWidth > 0 && imageHeight > 0 && containerWidth > 0 && containerHeight > 0) {
      // Calculate zoom to fit entire image in viewport
      const zoomX = containerWidth / imageWidth;
      const zoomY = containerHeight / imageHeight;
      const calculatedZoom = Math.min(zoomX, zoomY, 1); // Don't go above 1x
      setFitToScreenZoom(calculatedZoom);

      // Calculate center position
      // The scaled image dimensions
      const scaledWidth = imageWidth * calculatedZoom;
      const scaledHeight = imageHeight * calculatedZoom;

      // Center the image in the container
      const centerX = (containerWidth - scaledWidth) / 2;
      const centerY = (containerHeight - scaledHeight) / 2;

      setZoom(calculatedZoom);
      setPanX(centerX);
      setPanY(centerY);
    }
  };

  // Add wheel listener to content ref
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Reset fitToScreenZoom reference on map change
  useEffect(() => {
    setFitToScreenZoom(1);
  }, [activeMap?.id]);

  return (
    <div className="player-screen">
      <div className="player-screen-players">
        <p className="player-screen-title">
          Online {!connected && <span style={{ color: '#ff6b6b', fontSize: '0.8em' }}>(Disconnected)</span>}
        </p>
        <div className="online-list">
          {sortedUsers.length ? (
            <ul>
              {sortedUsers.map((user) => (
                <li key={user.id} className={user.role === 'dm' ? 'online-dm' : 'online-player'}>
                  {user.role === 'dm' ? `${user.name} (DM)` : user.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="online-empty">No one online yet.</p>
          )}
        </div>
      </div>
      <div
        ref={contentRef}
        className="player-screen-content"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {activeMap ? (
          <>
            <InitiativeTracker
              mapId={activeMap.id}
              isDM={false}
              isSelectingToken={false}
              onSelectingChange={() => {}}
              onTokenSelected={async () => {}}
            />
            <div className="map-zoom-container" style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: '0 0' }}>
              <img
                ref={imageRef}
                src={getMapUrl(activeMap.filepath)}
                alt={activeMap.name}
                className="active-map-image"
                draggable={false}
                onLoad={handleImageLoad}
                style={{ display: 'block', userSelect: 'none' }}
              />
              <GridOverlay map={activeMap} />
              <MapTokenLayer map={activeMap} campaignId={sessionID || ''} isDM={false} zoom={zoom} panX={panX} panY={panY} tokenUpdate={tokenUpdate} />
            </div>
          </>
        ) : (
          <p style={{ color: '#888', textAlign: 'center', marginTop: '2rem' }}>
            Waiting for DM to display a map...
          </p>
        )}
        {zoom > fitToScreenZoom && (
          <div className="zoom-controls-hint" style={{ position: 'absolute', bottom: '1rem', right: '1rem', color: '#888', fontSize: '0.8rem' }}>
            Scroll to zoom | Drag to pan
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerView;

