import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  DollarSign, 
  Users, 
  Utensils, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  Loader2, 
  ChevronRight,
  ChevronDown,
  Package,
  ListChecks,
  Navigation
} from 'lucide-react';
import './App.css';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icon
const createCustomIcon = (isActive) => new L.Icon({
  iconUrl: isActive 
    ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png'
    : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map component that handles centering
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 13, { duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
}

// City coordinates mapping (European focus)
const cityCoordinates = {
  'paris': [48.8566, 2.3522],
  'london': [51.5074, -0.1278],
  'rome': [41.9028, 12.4964],
  'barcelona': [41.3851, 2.1734],
  'amsterdam': [52.3676, 4.9041],
  'berlin': [52.5200, 13.4050],
  'vienna': [48.2082, 16.3738],
  'prague': [50.0755, 14.4378],
  'lisbon': [38.7223, -9.1393],
  'munich': [48.1351, 11.5820],
  'florence': [43.7696, 11.2558],
  'venice': [45.4408, 12.3155],
  'madrid': [40.4168, -3.7038],
  'brussels': [50.8503, 4.3517],
  'zurich': [47.3769, 8.5417],
  'copenhagen': [55.6761, 12.5683],
  'stockholm': [59.3293, 18.0686],
  'dublin': [53.3498, -6.2603],
  'milan': [45.4642, 9.1900],
  'nice': [43.7102, 7.2620],
  'default': [48.8566, 2.3522] // Paris as default
};

function getCityCoords(cityName) {
  if (!cityName) return cityCoordinates.default;
  const key = cityName.toLowerCase().trim();
  return cityCoordinates[key] || cityCoordinates.default;
}

function App() {
  const [formData, setFormData] = useState({
    budget: '',
    guests: '',
    dietary: '',
    theme: ''
  });

  const [sessionId] = useState('session_' + Math.random().toString(36).substr(2, 9));
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userReply, setUserReply] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [expandedDays, setExpandedDays] = useState({});
  const [mapCenter, setMapCenter] = useState([48.8566, 2.3522]);
  const responseRef = useRef(null);

  // Use relative URL - works in both v0 sandbox and production (Vercel routes via vercel.json)
  const apiUrl = '/_/backend/api/plan';

  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [response]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSelectedLocation(null);
    setSelectedDay(null);
    try {
      const result = await axios.post(apiUrl, { 
         sessionId,
         formData 
      });
      setResponse(result.data.data);
      // Set initial map center based on first city in itinerary
      if (result.data.data?.type === 'artifact' && result.data.data?.data?.itinerary?.[0]?.city) {
        const coords = getCityCoords(result.data.data.data.itinerary[0].city);
        setMapCenter(coords);
        setSelectedDay(0);
      }
    } catch (error) {
      console.error('Submission failed', error);
      setResponse({ type: 'error', message: 'Failed to connect to backend. Please ensure the server is running.' });
    }
    setLoading(false);
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await axios.post(apiUrl, {
         sessionId,
         userReply
      });
      setResponse(result.data.data);
      setUserReply('');
    } catch (error) {
      console.error('Reply failed', error);
      setResponse({ type: 'error', message: 'Failed to connect to backend.' });
    }
    setLoading(false);
  };

  const handleActivityClick = (day, dayIndex, activity, activityIndex) => {
    const coords = getCityCoords(day.city);
    // Add slight offset for different activities
    const offset = activityIndex * 0.002;
    const adjustedCoords = [coords[0] + offset, coords[1] + offset];
    setSelectedLocation({
      coords: adjustedCoords,
      activity,
      day,
      dayIndex,
      activityIndex
    });
    setMapCenter(adjustedCoords);
    setSelectedDay(dayIndex);
  };

  const handleDayClick = (day, dayIndex) => {
    const coords = getCityCoords(day.city);
    setMapCenter(coords);
    setSelectedDay(dayIndex);
    setSelectedLocation(null);
    // Toggle expanded state
    setExpandedDays(prev => ({
      ...prev,
      [dayIndex]: !prev[dayIndex]
    }));
  };

  // Get all markers for the map
  const getMarkers = () => {
    if (!response?.data?.itinerary) return [];
    const markers = [];
    response.data.itinerary.forEach((day, dayIndex) => {
      const baseCoords = getCityCoords(day.city);
      day.activities.forEach((activity, actIdx) => {
        const offset = actIdx * 0.003;
        markers.push({
          coords: [baseCoords[0] + offset, baseCoords[1] + offset],
          activity,
          day,
          dayIndex,
          activityIndex: actIdx,
          isActive: selectedLocation?.dayIndex === dayIndex && selectedLocation?.activityIndex === actIdx
        });
      });
    });
    return markers;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <Sparkles className="logo-icon" />
            <h1>ItineraAI</h1>
          </div>
          <p className="tagline">AI-Powered European Event Planning</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Input Form */}
        <section className="form-section">
          <div className="form-card">
            <div className="form-header">
              <h2>Plan Your Event</h2>
              <p>Enter your event details and let AI create the perfect itinerary</p>
            </div>
            
            <form onSubmit={handleSubmit} className="event-form">
              <div className="form-grid">
                <div className="input-group">
                  <label>
                    <DollarSign size={16} />
                    Budget
                  </label>
                  <input 
                    type="number" 
                    placeholder="e.g., 15000" 
                    value={formData.budget} 
                    onChange={(e) => setFormData({...formData, budget: e.target.value})} 
                    required
                  />
                </div>
                
                <div className="input-group">
                  <label>
                    <Users size={16} />
                    Guest Count
                  </label>
                  <input 
                    type="number" 
                    placeholder="e.g., 50" 
                    value={formData.guests} 
                    onChange={(e) => setFormData({...formData, guests: e.target.value})} 
                    required
                  />
                </div>
                
                <div className="input-group">
                  <label>
                    <Utensils size={16} />
                    Dietary Requirements
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g., Vegan, Gluten-free, Nut-free" 
                    value={formData.dietary} 
                    onChange={(e) => setFormData({...formData, dietary: e.target.value})} 
                  />
                </div>
                
                <div className="input-group">
                  <label>
                    <Sparkles size={16} />
                    Theme / Vibe
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g., Historic, Modern, Romantic" 
                    value={formData.theme} 
                    onChange={(e) => setFormData({...formData, theme: e.target.value})} 
                  />
                </div>
              </div>
              
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? (
                  <>
                    <Loader2 className="spin" size={20} />
                    Creating Your Itinerary...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Generate Event Plan
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* Response Section */}
        {response && (
          <section className="response-section" ref={responseRef}>
            {/* Conflict Report */}
            {response.type === 'conflict_report' && (
              <div className="conflict-card">
                <div className="conflict-header">
                  <AlertTriangle size={24} />
                  <h3>Conflict Detected</h3>
                </div>
                
                <div className="conflict-content">
                  <div className="conflict-item">
                    <strong>Issue:</strong>
                    <p>{response.data.identified_conflict}</p>
                  </div>
                  
                  <div className="conflict-item">
                    <strong>Violated Constraint:</strong>
                    <p>{response.data.violated_constraint}</p>
                  </div>
                  
                  {response.data.proposed_resolutions?.length > 0 && (
                    <div className="resolutions">
                      <strong>Suggested Resolutions:</strong>
                      <ul>
                        {response.data.proposed_resolutions.map((res, index) => (
                          <li key={index}>
                            <ChevronRight size={16} />
                            {res}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleReplySubmit} className="reply-form">
                  <input 
                    type="text" 
                    placeholder="Type your resolution (e.g., 'Increase budget to $20000')..."
                    value={userReply}
                    onChange={(e) => setUserReply(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                  </button>
                </form>
              </div>
            )}

            {/* Itinerary Artifact */}
            {response.type === 'artifact' && (
              <div className="itinerary-section">
                {/* Itinerary Header */}
                <div className="itinerary-header">
                  <div className="header-left">
                    <CheckCircle2 size={28} className="success-icon" />
                    <div>
                      <h2>Your Event Itinerary</h2>
                      <span className="trip-id">Trip ID: {response.data.trip_id}</span>
                    </div>
                  </div>
                  <div className="budget-badge">
                    <DollarSign size={18} />
                    <span>${response.data.total_budget_utilized?.toLocaleString()}</span>
                    <small>Budget Utilized</small>
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="itinerary-grid">
                  {/* Left Panel - Schedule */}
                  <div className="schedule-panel">
                    <h3>
                      <Calendar size={20} />
                      Daily Schedule
                    </h3>
                    
                    <div className="days-list">
                      {response.data.itinerary.map((day, dayIndex) => (
                        <div 
                          key={dayIndex} 
                          className={`day-card ${selectedDay === dayIndex ? 'active' : ''}`}
                        >
                          <div 
                            className="day-header"
                            onClick={() => handleDayClick(day, dayIndex)}
                          >
                            <div className="day-info">
                              <span className="day-number">Day {day.day}</span>
                              <span className="day-date">{day.date}</span>
                            </div>
                            <div className="day-header-right">
                              <div className="day-city">
                                <MapPin size={14} />
                                {day.city}
                              </div>
                              <ChevronDown 
                                size={18} 
                                className={`expand-icon ${expandedDays[dayIndex] ? 'expanded' : ''}`}
                              />
                            </div>
                          </div>
                          
                          {expandedDays[dayIndex] && (
                            <div className="activities-list">
                            {day.activities.map((activity, actIdx) => (
                              <div 
                                key={actIdx} 
                                className={`activity-item ${activity.type} ${
                                  selectedLocation?.dayIndex === dayIndex && 
                                  selectedLocation?.activityIndex === actIdx ? 'selected' : ''
                                }`}
                                onClick={() => handleActivityClick(day, dayIndex, activity, actIdx)}
                              >
                                <div className="activity-type">
                                  {activity.type === 'transit' ? (
                                    <Navigation size={14} />
                                  ) : (
                                    <MapPin size={14} />
                                  )}
                                  <span>{activity.type}</span>
                                </div>
                                <p className="activity-desc">{activity.description}</p>
                                <div className="activity-meta">
                                  <span>
                                    <Clock size={12} />
                                    {activity.duration_mins} mins
                                  </span>
                                  {activity.sourceCitation && (
                                    <span className="source">
                                      {activity.sourceCitation}
                                    </span>
                                  )}
                                </div>
                                {activity.warnings?.length > 0 && (
                                  <div className="activity-warning">
                                    <AlertTriangle size={12} />
                                    {activity.warnings.join(' ')}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Panel - Map */}
                  <div className="map-panel">
                    <h3>
                      <MapPin size={20} />
                      Interactive Map
                    </h3>
                    <div className="map-container">
                      <MapContainer
                        center={mapCenter}
                        zoom={13}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapController center={mapCenter} zoom={13} />
                        
                        {getMarkers().map((marker, idx) => (
                          <Marker
                            key={idx}
                            position={marker.coords}
                            icon={createCustomIcon(marker.isActive)}
                          >
                            <Popup>
                              <div className="map-popup">
                                <strong>Day {marker.day.day} - {marker.day.city}</strong>
                                <p>{marker.activity.description}</p>
                                <span className="popup-duration">
                                  <Clock size={12} /> {marker.activity.duration_mins} mins
                                </span>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                    
                    {selectedLocation && (
                      <div className="location-details">
                        <h4>Selected Activity</h4>
                        <div className="detail-content">
                          <span className={`type-badge ${selectedLocation.activity.type}`}>
                            {selectedLocation.activity.type}
                          </span>
                          <p>{selectedLocation.activity.description}</p>
                          <div className="detail-meta">
                            <span><MapPin size={14} /> {selectedLocation.day.city}</span>
                            <span><Clock size={14} /> {selectedLocation.activity.duration_mins} mins</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Checklists */}
                <div className="checklists-grid">
                  <div className="checklist-card planning">
                    <div className="checklist-header">
                      <ListChecks size={20} />
                      <h4>Planning Checklist</h4>
                    </div>
                    <ul>
                      {response.data.planning_checklist?.map((item, idx) => (
                        <li key={idx}>
                          <CheckCircle2 size={16} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="checklist-card packing">
                    <div className="checklist-header">
                      <Package size={20} />
                      <h4>Packing List</h4>
                    </div>
                    <ul>
                      {response.data.packing_list?.map((item, idx) => (
                        <li key={idx}>
                          <CheckCircle2 size={16} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {response.type === 'error' && (
              <div className="error-card">
                <AlertTriangle size={24} />
                <div>
                  <h3>Error Occurred</h3>
                  <p>{response.message}</p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>Powered by AI • Built for European Event Planning</p>
      </footer>
    </div>
  );
}

export default App;
