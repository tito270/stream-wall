import { useState, useEffect, useRef } from 'react';

interface AudioLevels {
  left: number;
  right: number;
}

export function useAudioLevels(videoRef: React.RefObject<HTMLVideoElement>) {
  const [levels, setLevels] = useState<AudioLevels>({ left: 0, right: 0 });
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();
  const sourceRef = useRef<MediaElementAudioSourceNode>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initAudioAnalysis = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          sourceRef.current = audioContextRef.current.createMediaElementSource(video);
          
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          
          analyserRef.current.fftSize = 256;
        }

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateLevels = () => {
          if (!analyser) return;
          
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average levels for left and right channels
          const leftSum = dataArray.slice(0, bufferLength / 2).reduce((a, b) => a + b, 0);
          const rightSum = dataArray.slice(bufferLength / 2).reduce((a, b) => a + b, 0);
          
          const leftLevel = (leftSum / (bufferLength / 2)) / 255;
          const rightLevel = (rightSum / (bufferLength / 2)) / 255;
          
          setLevels({ left: leftLevel, right: rightLevel });
          
          animationRef.current = requestAnimationFrame(updateLevels);
        };

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        updateLevels();
      } catch (error) {
        // Silent fail for audio analysis - not critical for video playback
        console.debug('Audio analysis unavailable:', error);
      }
    };

    const handlePlay = () => initAudioAnalysis();
    const handlePause = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setLevels({ left: 0, right: 0 });
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handlePause);
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [videoRef]);

  return levels;
}