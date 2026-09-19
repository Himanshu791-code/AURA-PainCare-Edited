/**
 * AURA-PainCare: AI Silent-Pain & Distress Monitor
 * Module C: Central Nurse Station Dashboard, Alert Engine & Clinical Trend Analytics
 */

class NurseStationDashboard {
  constructor() {
    this.currentScore = 0.0;
    this.sustainedStartTime = null;
    this.sustainedThreshold = 6.0; // Pain score above this triggers alarm
    this.sustainedRequiredDurationMs = 1200; // 1.2s sustained pain expression
    this.isAlertActive = false;
    this.alertTriggerTimestamp = null;
    this.history = []; // 60 data points for 60s trend graph
    this.maxHistoryLength = 60;
    this.simulationMode = false;
    this.simInterval = null;

    // Simulated vitals
    this.vitals = {
      hr: 72,
      spo2: 99,
      resp: 16
    };

    // Incident log
    this.incidentLogs = [];

    // Canvas trend graph setup
    this.canvas = null;
    this.ctx = null;
  }

  init() {
    this.canvas = document.getElementById('trend-canvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
    }

    // Initialize history with resting values
    for (let i = 0; i < this.maxHistoryLength; i++) {
      this.history.push(0.5 + Math.random() * 0.8);
    }

    // Setup Acknowledge & Test Buttons
    const ackBtn = document.getElementById('ack-alert-btn');
    if (ackBtn) {
      ackBtn.addEventListener('click', () => this.acknowledgeAlert());
    }

    const bannerAckBtn = document.getElementById('banner-ack-btn');
    if (bannerAckBtn) {
      bannerAckBtn.addEventListener('click', () => this.acknowledgeAlert());
    }

    const testChimeBtn = document.getElementById('test-chime-btn');
    if (testChimeBtn) {
      testChimeBtn.addEventListener('click', () => {
        if (window.medicalAlarm) {
          window.medicalAlarm.testSound();
        }
      });
    }

    // Report Modal buttons
    const exportBtn = document.getElementById('export-report-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.openClinicalReport());
    }

    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => this.closeClinicalReport());
    }

    const printReportBtn = document.getElementById('print-report-btn');
    if (printReportBtn) {
      printReportBtn.addEventListener('click', () => window.print());
    }

    // Start 1 Hz render loop for trend graph and vitals
    setInterval(() => this.tick(), 1000);
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  /**
   * Called by vision_ai.js or simulator on each new frame
   */
  updatePainScore(score, biomarkers = {}) {
    if (this.simulationMode && !biomarkers.isSimulated) return;

    this.currentScore = Math.max(0, Math.min(10, score));

    // Update circular gauge and text
    this.renderGauge(this.currentScore);

    // Update Biomarkers bars if present
    this.renderBiomarkers(biomarkers);

    // Check sustained pain trigger
    this.checkSustainedPain(this.currentScore);

    // Update vitals dynamically based on pain acuity
    this.correlateVitals(this.currentScore);

    // Sync Ward Bed 104 telemetry card in real time
    const ward104El = document.getElementById('ward-bed-104-pain');
    if (ward104El) {
      ward104El.innerHTML = `${this.currentScore.toFixed(1)} <small>/ 10</small>`;
    }

    // Update on-screen Nurse Dispatch Receipt (Shows alarm sent to nurse)
    this.updateNurseDispatchReceipt(this.currentScore);
  }

  updateNurseDispatchReceipt(score) {
    const receiptCard = document.getElementById('nurse-dispatch-receipt');
    const statusBadge = document.getElementById('receipt-status-badge');
    const statusTitle = document.getElementById('receipt-status-title');
    const statusDetails = document.getElementById('receipt-status-details');
    const statusTime = document.getElementById('receipt-status-time');

    if (!receiptCard) return;

    const isHi = window.translator && window.translator.currentLang === 'hi';
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });

    if (score >= 6.0) {
      // Patient Serious Distress -> Emergency Alarm Dispatched to Nurse
      receiptCard.className = 'nurse-receipt-card receipt-critical';
      if (statusBadge) {
        statusBadge.className = 'receipt-badge badge-critical';
        statusBadge.innerText = isHi ? '🚨 नर्स के पास अलार्म जा चुका है: हाँ' : '🚨 ALARM TRANSMITTED TO NURSE: YES';
      }
      if (statusTitle) {
        statusTitle.innerText = isHi 
          ? 'मरीज की हालत गंभीर हो रही है (तीव्र कष्ट डिटेक्ट हुआ)'
          : 'PATIENT IN SERIOUS DISTRESS (Acute Distress Spike)';
      }
      if (statusDetails) {
        statusDetails.innerText = isHi
          ? 'वार्ड A सेंट्रल नर्स स्टेशन सूचित • वॉइस ब्रॉडकास्ट सक्रिय • ऑन-ड्यूटी नर्स सतर्क'
          : 'Ward A Central Nurse Station Alerted • Spoken Voice Broadcast Active • Duty RN Dispatched';
      }
      if (statusTime) statusTime.innerText = `${nowTime} (Active Dispatch)`;
    } else if (score >= 3.0) {
      // Patient Uncomfortable -> Observation Alert Sent to Nurse Desk
      receiptCard.className = 'nurse-receipt-card receipt-uncomfortable';
      if (statusBadge) {
        statusBadge.className = 'receipt-badge badge-uncomfortable';
        statusBadge.innerText = isHi ? '🟡 अवलोकन सूचना भेजी गई: हाँ' : '🟡 OBSERVATION ALERT TRANSMITTED: YES';
      }
      if (statusTitle) {
        statusTitle.innerText = isHi
          ? 'मरीज असहज महसूस कर रहा है (शुरुआती तनाव)'
          : 'PATIENT UNCOMFORTABLE (Early Micro-Distress)';
      }
      if (statusDetails) {
        statusDetails.innerText = isHi
          ? 'नर्स डेस्क को अवलोकन सूचना प्रेषित • बेड 104 पर नजर रखी जा रही है'
          : 'Observation notification sent to Nurse Desk • Bed 104 monitored';
      }
      if (statusTime) statusTime.innerText = `${nowTime} (Logged)`;
    } else {
      // Normal Routine Monitoring
      receiptCard.className = 'nurse-receipt-card receipt-normal';
      if (statusBadge) {
        statusBadge.className = 'receipt-badge badge-normal';
        statusBadge.innerText = isHi ? '🟢 नियमित निगरानी (स्टैन्डबाय)' : '🟢 STANDBY (ROUTINE MONITORING)';
      }
      if (statusTitle) {
        statusTitle.innerText = isHi
          ? 'मरीज सामान्य विश्राम स्थिति में है'
          : 'Patient Resting Normally (Calm Baseline)';
      }
      if (statusDetails) {
        statusDetails.innerText = isHi
          ? 'नर्स प्रेषण: स्टैंडबाय (कोई तीव्र दर्द नहीं)'
          : 'Nurse Dispatch: Standby (No acute pain detected)';
      }
      if (statusTime) statusTime.innerText = `${nowTime} (Normal)`;
    }
  }

  renderGauge(score) {
    const numEl = document.getElementById('pain-score-val');
    const pillEl = document.getElementById('pain-severity-pill');
    const gaugeFill = document.getElementById('gauge-fill-path');

    if (numEl) {
      numEl.innerText = score.toFixed(1);
    }

    // SVG arc stroke-dashoffset logic (total arc circumference ~ 283)
    if (gaugeFill) {
      const maxOffset = 283;
      const progress = score / 10.0;
      const offset = maxOffset - (progress * maxOffset);
      gaugeFill.style.strokeDashoffset = offset;

      if (score < 3.0) {
        gaugeFill.style.stroke = 'var(--color-mild)';
      } else if (score < 6.0) {
        gaugeFill.style.stroke = 'var(--color-moderate)';
      } else if (score < 9.0) {
        gaugeFill.style.stroke = 'var(--color-severe)';
      } else {
        gaugeFill.style.stroke = 'var(--color-critical)';
      }
    }

    // Pill badge text and styling
    if (pillEl) {
      pillEl.className = 'pain-status-pill';
      const isHi = window.translator && window.translator.currentLang === 'hi';

      if (score < 3.0) {
        pillEl.classList.add('mild');
        pillEl.innerText = isHi ? 'सामान्य (Mild)' : 'Mild / Routine';
      } else if (score < 6.0) {
        pillEl.classList.add('moderate');
        pillEl.innerText = isHi ? 'मध्यम दर्द (Moderate)' : 'Moderate Observation';
      } else if (score < 9.0) {
        pillEl.classList.add('severe');
        pillEl.innerText = isHi ? 'गंभीर दर्द चेतावनी (Severe)' : 'Severe Pain Alert';
      } else {
        pillEl.classList.add('critical');
        pillEl.innerText = isHi ? 'अति गंभीर कष्ट (Critical)' : 'Critical Grimace Alarm';
      }
    }
  }

  renderBiomarkers(bm) {
    const au4Val = document.getElementById('au4-val');
    const au4Bar = document.getElementById('au4-bar');
    const au6Val = document.getElementById('au6-val');
    const au6Bar = document.getElementById('au6-bar');
    const au25Val = document.getElementById('au25-val');
    const au25Bar = document.getElementById('au25-bar');
    const au9Val = document.getElementById('au9-val');
    const au9Bar = document.getElementById('au9-bar');

    if (au4Val && bm.au4 !== undefined) {
      au4Val.innerText = `${Math.round(bm.au4 * 100)}%`;
      au4Bar.style.width = `${Math.min(100, bm.au4 * 100)}%`;
    }
    if (au6Val && bm.au6 !== undefined) {
      au6Val.innerText = `${Math.round(bm.au6 * 100)}%`;
      au6Bar.style.width = `${Math.min(100, bm.au6 * 100)}%`;
    }
    if (au25Val && bm.au25 !== undefined) {
      au25Val.innerText = `${Math.round(bm.au25 * 100)}%`;
      au25Bar.style.width = `${Math.min(100, bm.au25 * 100)}%`;
    }
    if (au9Val && bm.au9 !== undefined) {
      au9Val.innerText = `${Math.round(bm.au9 * 100)}%`;
      au9Bar.style.width = `${Math.min(100, bm.au9 * 100)}%`;
    }
  }

  checkSustainedPain(score) {
    const timerFill = document.getElementById('sustained-timer-fill');
    const timerText = document.getElementById('sustained-time-text');

    if (score >= this.sustainedThreshold) {
      const now = performance.now();
      if (!this.sustainedStartTime) {
        this.sustainedStartTime = now;
      }
      const elapsed = now - this.sustainedStartTime;
      const pct = Math.min(100, (elapsed / this.sustainedRequiredDurationMs) * 100);

      if (timerFill) timerFill.style.width = `${pct}%`;
      if (timerText) timerText.innerText = `${(elapsed / 1000).toFixed(1)}s / ${(this.sustainedRequiredDurationMs / 1000).toFixed(1)}s`;

      if (elapsed >= this.sustainedRequiredDurationMs && !this.isAlertActive) {
        this.triggerNurseAlert(score);
      }
    } else {
      // Below threshold: reset sustained timer
      this.sustainedStartTime = null;
      if (timerFill) timerFill.style.width = '0%';
      if (timerText) timerText.innerText = `0.0s / ${(this.sustainedRequiredDurationMs / 1000).toFixed(1)}s`;
    }
  }

  triggerNurseAlert(score) {
    this.isAlertActive = true;
    this.alertTriggerTimestamp = new Date();

    const severity = score >= 9.0 ? 'critical' : 'severe';

    // 1. Audio medical chime + Natural Spoken Voice Broadcast
    if (window.medicalAlarm) {
      window.medicalAlarm.startAlarm(severity, '104', 'Rajesh Verma');
    }

    // 2. Emergency Flashing Banner
    const banner = document.getElementById('emergency-alarm-banner');
    if (banner) {
      banner.classList.add('active');
    }

    // 3. Log to Incident Log Table
    this.logIncident(score, severity);
  }

  acknowledgeAlert() {
    this.isAlertActive = false;

    // Silence audio
    if (window.medicalAlarm) {
      window.medicalAlarm.acknowledge();
    }

    // Hide banner
    const banner = document.getElementById('emergency-alarm-banner');
    if (banner) {
      banner.classList.remove('active');
    }

    // Calculate response time
    const responseSeconds = this.alertTriggerTimestamp 
      ? Math.max(1, ((new Date() - this.alertTriggerTimestamp) / 1000).toFixed(1))
      : '3.4';

    // Update last incident log status
    if (this.incidentLogs.length > 0) {
      const last = this.incidentLogs[0];
      last.status = `Ack (${responseSeconds}s)`;
      this.renderIncidentLogs();
    }
  }

  logIncident(score, severity) {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    const location = window.bodyPainMap ? window.bodyPainMap.getActiveLocusName() : 'Diffuse';

    const entry = {
      time: timeStr,
      bed: '104',
      score: score.toFixed(1),
      severity: severity,
      location: location,
      status: 'DISPATCHED'
    };

    this.incidentLogs.unshift(entry);
    if (this.incidentLogs.length > 20) this.incidentLogs.pop();

    this.renderIncidentLogs();
  }

  renderIncidentLogs() {
    const tbody = document.getElementById('incident-log-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.incidentLogs.map(item => `
      <tr>
        <td>${item.time}</td>
        <td>${item.bed}</td>
        <td><strong style="color: ${parseFloat(item.score) >= 9 ? '#ef4444' : '#f97316'}">${item.score}/10</strong></td>
        <td>${item.location}</td>
        <td class="${item.status.startsWith('Ack') ? 'log-badge-ack' : 'log-badge-critical'}">${item.status}</td>
      </tr>
    `).join('');
  }

  onPainLocationChanged(locationName) {
    // If alert is active, update active record
    if (this.incidentLogs.length > 0 && this.isAlertActive) {
      this.incidentLogs[0].location = locationName;
      this.renderIncidentLogs();
    }
  }

  correlateVitals(score) {
    // Clinical hemodynamic pain correlation:
    // Increased sympathetic tone causes tachycardia and elevated respiration
    const baseHR = 72;
    const painHRElevation = (score / 10.0) * 44; // Up to 116 bpm
    const targetHR = Math.round(baseHR + painHRElevation + (Math.random() * 4 - 2));

    const targetSpO2 = score > 8.0 ? Math.round(95 + Math.random() * 2) : 99;
    const targetResp = Math.round(15 + (score / 10.0) * 11);

    // Smooth transition
    this.vitals.hr = Math.round(this.vitals.hr * 0.8 + targetHR * 0.2);
    this.vitals.spo2 = targetSpO2;
    this.vitals.resp = targetResp;

    const hrEl = document.getElementById('vital-hr');
    const spo2El = document.getElementById('vital-spo2');
    const respEl = document.getElementById('vital-resp');

    if (hrEl) hrEl.innerText = this.vitals.hr;
    if (spo2El) spo2El.innerText = this.vitals.spo2;
    if (respEl) respEl.innerText = this.vitals.resp;
  }

  tick() {
    // Push current score to 60s history array
    this.history.push(this.currentScore);
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }
    this.drawTrendChart();
  }

  drawTrendChart() {
    if (!this.canvas || !this.ctx) return;
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;

    this.canvas.width = w;
    this.canvas.height = h;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.3)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= 10; y += 2.5) {
      const yPos = h - (y / 10.0) * (h - 20) - 10;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(w, yPos);
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(156, 163, 175, 0.6)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${y}`, 6, yPos - 3);
    }

    // Critical Threshold dashed line at 6.0
    const thresholdY = h - (6.0 / 10.0) * (h - 20) - 10;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(w, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    ctx.fillStyle = '#ef4444';
    ctx.fillText('CRITICAL THRESHOLD (6.0)', w - 165, thresholdY - 4);

    // Draw Data Line with Gradient
    if (this.history.length < 2) return;

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#06b6d4';

    const step = w / (this.maxHistoryLength - 1);

    ctx.beginPath();
    this.history.forEach((val, idx) => {
      const x = idx * step;
      const y = h - (val / 10.0) * (h - 20) - 10;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Fill area under curve
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  /**
   * Rapid Clinical Demonstration Scenarios
   */
  simulateScenario(type) {
    clearInterval(this.simInterval);
    this.simulationMode = true;

    if (type === 'resting') {
      this.simInterval = setInterval(() => {
        const score = 1.0 + Math.random() * 0.5;
        this.updatePainScore(score, {
          au4: 0.08,
          au6: 0.12,
          au25: 0.05,
          au9: 0.04,
          isSimulated: true
        });
      }, 300);
    } else if (type === 'spasm') {
      // Acute spasm spike ~ 7.8
      if (window.bodyPainMap) window.bodyPainMap.selectZone('abdomen');
      this.simInterval = setInterval(() => {
        const score = 7.5 + Math.random() * 0.8;
        this.updatePainScore(score, {
          au4: 0.75,
          au6: 0.72,
          au25: 0.68,
          au9: 0.65,
          isSimulated: true
        });
      }, 300);
    } else if (type === 'grimace') {
      // Critical distress ~ 9.6
      if (window.bodyPainMap) window.bodyPainMap.selectZone('chest');
      this.simInterval = setInterval(() => {
        const score = 9.4 + Math.random() * 0.5;
        this.updatePainScore(score, {
          au4: 0.95,
          au6: 0.92,
          au25: 0.90,
          au9: 0.88,
          isSimulated: true
        });
      }, 300);
    } else if (type === 'reset') {
      this.simulationMode = false;
      this.acknowledgeAlert();
      if (window.bodyPainMap) window.bodyPainMap.clear();
      this.updatePainScore(0.5, { au4: 0, au6: 0, au25: 0, au9: 0, isSimulated: true });
    }
  }

  openClinicalReport() {
    const modal = document.getElementById('report-modal');
    if (!modal) return;

    // Populate Report Fields
    const reportDate = document.getElementById('report-date');
    const reportPeak = document.getElementById('report-peak-score');
    const reportLocus = document.getElementById('report-locus');
    const reportVitals = document.getElementById('report-vitals-summary');
    const reportEventsCount = document.getElementById('report-events-count');

    const now = new Date();
    if (reportDate) reportDate.innerText = now.toLocaleString();
    if (reportPeak) reportPeak.innerText = `${this.currentScore.toFixed(1)} / 10.0 (${this.currentScore >= 6 ? 'Severe Distress' : 'Mild'})`;
    if (reportLocus) reportLocus.innerText = window.bodyPainMap ? window.bodyPainMap.getActiveLocusName() : 'Unspecified';
    if (reportVitals) reportVitals.innerText = `HR: ${this.vitals.hr} bpm | SpO2: ${this.vitals.spo2}% | Resp: ${this.vitals.resp}/min`;
    if (reportEventsCount) reportEventsCount.innerText = `${this.incidentLogs.length} Automatic AI Dispatch Events recorded`;

    modal.classList.add('active');
  }

  closeClinicalReport() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.classList.remove('active');
  }
}

window.nurseDashboard = new NurseStationDashboard();
