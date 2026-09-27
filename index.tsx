import React, { useState, useEffect } from 'react';

export default function HydroPeakModule() {
  const [statusInfo, setStatusInfo] = useState({
    season: '',
    status: '',
    recommendation: '',
    isPeak: false
  });

  useEffect(() => {
    const checkHydroStatus = () => {
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      const hour = now.getHours();

      // Summer period: April 1 to November 30
      const isSummer = month >= 4 && month <= 11;

      if (isSummer) {
        setStatusInfo({
          season: 'Summer (Apr 1 - Nov 30)',
          status: 'Off-Peak',
          recommendation: 'Safe to run heavy appliances (washing machine, dishwasher, EV) anytime.',
          isPeak: false
        });
      } else {
        // Winter peak hours: 6:00 to 10:00 and 16:00 to 20:00
        const isMorningPeak = hour >= 6 && hour < 10;
        const isEveningPeak = hour >= 16 && hour < 20;

        if (isMorningPeak || isEveningPeak) {
          setStatusInfo({
            season: 'Winter (Dec 1 - Mar 31)',
            status: 'CRITICAL PEAK WINDOW',
            recommendation: 'AVOID heavy appliances right now to prevent high rates!',
            isPeak: true
          });
        } else {
          setStatusInfo({
            season: 'Winter (Dec 1 - Mar 31)',
            status: 'Off-Peak Window',
            recommendation: 'Safe to run appliances outside active morning/evening blocks.',
            isPeak: false
          });
        }
      }
    };

    checkHydroStatus();
    const interval = setInterval(checkHydroStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '16px', color: '#fff', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>⚡ Hydro-Québec Peak Tracker</h3>
        <p style={{ margin: '4px 0', fontSize: '14px', opacity: 0.8 }}>Season: {statusInfo.season}</p>
      </div>
      
      <div style={{ 
        background: statusInfo.isPeak ? 'rgba(231, 76, 60, 0.3)' : 'rgba(46, 204, 113, 0.2)', 
        border: `1px solid ${statusInfo.isPeak ? '#e74c3c' : '#2ecc71'}`,
        padding: '12px', 
        borderRadius: '8px' 
      }}>
        <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
          {statusInfo.status}
        </div>
        <div style={{ fontSize: '13px', opacity: 0.9 }}>
          {statusInfo.recommendation}
        </div>
      </div>
    </div>
  );
}
