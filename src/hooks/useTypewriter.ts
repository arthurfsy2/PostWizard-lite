'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseTypewriterOptions {
  text: string;
  speed?: number;
  enabled?: boolean;
  onComplete?: () => void;
}

export function useTypewriter({
  text,
  speed = 30,
  enabled = true,
  onComplete,
}: UseTypewriterOptions) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      return;
    }

    setIsTyping(true);
    setDisplayedText('');
    
    let currentIndex = 0;
    const textLength = text.length;
    
    const typeNextChar = () => {
      if (currentIndex < textLength) {
        const nextChar = text[currentIndex];
        setDisplayedText(prev => prev + nextChar);
        currentIndex++;
        
        // 根据字符类型调整速度
        let delay = speed;
        if (nextChar === '。' || nextChar === '！' || nextChar === '？') {
          delay = speed * 4; // 标点停顿更久
        } else if (nextChar === ',' || nextChar === '，') {
          delay = speed * 2;
        } else if (nextChar === '\n') {
          delay = speed * 3;
        }
        
        setTimeout(typeNextChar, delay);
      } else {
        setIsTyping(false);
        onComplete?.();
      }
    };

    // 开始打字效果前稍微延迟
    const startTimeout = setTimeout(typeNextChar, 200);

    return () => {
      clearTimeout(startTimeout);
    };
  }, [text, speed, enabled, onComplete]);

  const skip = useCallback(() => {
    setDisplayedText(text);
    setIsTyping(false);
  }, [text]);

  return { displayedText, isTyping, skip };
}
