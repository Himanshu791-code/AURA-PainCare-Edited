/**
 * AURA-PainCare: AI Silent-Pain & Distress Monitor
 * Audio & Spoken Voice Alert Engine (Synthesized Chime + Natural Speech Voice Broadcast)
 */

class MedicalAudioAlarm {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.isMuted = false;
    this.speechLoopId = null;
    this.activeSeverity = 'none';
    this.currentBed = '104';
    this.currentPatientName = 'Rajesh Verma';
    this.speechSynth = window.speechSynthesis;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playTone(freq, duration = 0.12, type = 'sine', startTime = 0) {
    this.initContext();
    if (this.isMuted) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + startTime);

      const attackTime = 0.015;
      const releaseTime = duration - 0.02;

      gain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.35, this.audioCtx.currentTime + startTime + attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + startTime + releaseTime);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(this.audioCtx.currentTime + startTime);
      osc.stop(this.audioCtx.currentTime + startTime + duration);
    } catch (e) {
      console.warn('AudioContext error:', e);
    }
  }

  playHighPriorityChime() {
    if (this.isMuted) return;
    this.initContext();

    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99];
    const spacing = 0.13;

    notes.forEach((freq, idx) => {
      this.playTone(freq, 0.11, 'triangle', idx * spacing);
    });
  }

  /**
   * Natural Text-To-Speech Spoken Voice Alert
   */
  speakText(text, lang = 'hi-IN') {
    if (!this.speechSynth || this.isMuted) return;

    // Cancel pending utterances
    this.speechSynth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05; // Urgent clinical pace
    utterance.pitch = 1.05;

    // Pick appropriate voice
    const voices = this.speechSynth.getVoices();
    if (voices && voices.length > 0) {
      const match = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
      if (match) utterance.voice = match;
    }

    this.speechSynth.speak(utterance);
  }

  /**
   * Spoken Urgent Call: "Bed 104 par patient ko urgent need hai, halat kharab ho rahi hai"
   */
  broadcastUrgentVoiceAlert(bed = '104', patientName = 'Rajesh Verma') {
    this.currentBed = bed;
    this.currentPatientName = patientName;

    const isHi = window.translator && window.translator.currentLang === 'hi';

    // Pre-alarm high attention chime
    this.playHighPriorityChime();

    // Spoken sentence constructed with high clinical urgency
    let voiceMessage = '';
    if (isHi) {
      voiceMessage = `सावधान! बेड नंबर ${bed} पर मरीज ${patientName} को तत्काल मदद की सख्त आवश्यकता है! मरीज की हालत बिगड़ रही है, तीव्र दर्द का पता चला है! नर्स तुरंत पहुंचें!`;
      setTimeout(() => this.speakText(voiceMessage, 'hi-IN'), 700);
    } else {
      voiceMessage = `Emergency Alert! Bed ${bed}, patient ${patientName} requires immediate medical assistance! Patient condition is deteriorating with severe acute pain! Attend immediately!`;
      setTimeout(() => this.speakText(voiceMessage, 'en-US'), 700);
    }
  }

  /**
   * Starts sustained repeating voice alarm loop
   */
  startAlarm(severity = 'severe', bed = '104', patientName = 'Rajesh Verma') {
    this.initContext();
    this.activeSeverity = severity;

    if (this.isPlaying) return;
    this.isPlaying = true;

    // Immediately trigger initial announcement
    this.broadcastUrgentVoiceAlert(bed, patientName);

    // Repeat voice broadcast every 6.5 seconds until acknowledged
    clearInterval(this.speechLoopId);
    this.speechLoopId = setInterval(() => {
      if (!this.isMuted && this.isPlaying) {
        this.broadcastUrgentVoiceAlert(this.currentBed, this.currentPatientName);
      }
    }, 6500);
  }

  stopAlarm() {
    this.isPlaying = false;
    this.activeSeverity = 'none';
    clearInterval(this.speechLoopId);
    this.speechLoopId = null;

    if (this.speechSynth) {
      this.speechSynth.cancel();
    }
  }

  acknowledge() {
    this.stopAlarm();
    this.playTone(880, 0.08, 'sine', 0);
  }

  /**
   * Direct Test for Evaluators & Users
   */
  testSound() {
    this.initContext();
    this.broadcastUrgentVoiceAlert('104', 'Rajesh Verma');
  }

  /**
   * Speak non-verbal patient requests (Water, Breath, etc.)
   */
  speakPatientRequest(requestEn, requestHi) {
    this.initContext();
    this.playTone(659.25, 0.12, 'sine', 0);

    const isHi = window.translator && window.translator.currentLang === 'hi';
    const text = isHi
      ? `बेड 104: ${requestHi}`
      : `Bed 104 Notification: ${requestEn}`;

    setTimeout(() => {
      this.speakText(text, isHi ? 'hi-IN' : 'en-US');
    }, 200);
  }
}

window.medicalAlarm = new MedicalAudioAlarm();
