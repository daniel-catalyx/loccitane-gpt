import { useRef, useState, useEffect, useContext, useLayoutEffect } from 'react'
import { CommandBarButton, IconButton, Dialog, DialogType, Stack } from '@fluentui/react'
import { SquareRegular, ShieldLockRegular, ErrorCircleRegular, SpeakerMute24Regular, Speaker124Regular } from '@fluentui/react-icons'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import uuid from 'react-uuid'
import { isEmpty } from 'lodash'
import DOMPurify from 'dompurify'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { nord } from 'react-syntax-highlighter/dist/esm/styles/prism'

import styles from './Chat.module.css'
import Contoso from '../../assets/thacatalyx_logo.png'
import { XSSAllowTags } from '../../constants/sanatizeAllowables'

import {
  ChatMessage,
  ConversationRequest,
  conversationApi,
  Citation,
  ToolMessageContent,
  AzureSqlServerExecResults,
  ChatResponse,
  getUserInfo,
  Conversation,
  historyGenerate,
  historyUpdate,
  historyClear,
  ChatHistoryLoadingState,
  CosmosDBStatus,
  ErrorMessage,
  ExecResults,
} from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ChatHistoryPanel } from "../../components/ChatHistory/ChatHistoryPanel";
import { AppStateContext } from "../../state/AppProvider";
import { useBoolean } from "@fluentui/react-hooks";

const enum messageStatus {
  NotRunning = 'Not Running',
  Processing = 'Processing',
  Done = 'Done'
}

// Enhanced Animated Avatar Component with Voice
const AnimatedAvatar: React.FC<{ isAnimating: boolean; isSpeaking: boolean }> = ({ isAnimating, isSpeaking }) => {
  const avatarRef = useRef<HTMLDivElement>(null);
  const mouthRef = useRef<HTMLDivElement>(null);
  const leftEyeRef = useRef<HTMLDivElement>(null);
  const rightEyeRef = useRef<HTMLDivElement>(null);
  const soundWavesRef = useRef<HTMLDivElement>(null);
  
  const animationFrameRef = useRef<number>();
  const eyeAnimationFrameRef = useRef<number>();
  const lastBlinkRef = useRef<number>(0);
  const blinkingRef = useRef<boolean>(false);

  const animateMouth = () => {
    if ((!isAnimating && !isSpeaking) || !mouthRef.current) return;
    
    // More dynamic mouth animation when speaking
    const minH = isSpeaking ? 8 : 12;
    const maxH = isSpeaking ? 45 : 38;
    const minW = isSpeaking ? 35 : 40;
    const maxW = isSpeaking ? 70 : 60;
    const speed = isSpeaking ? 60 : 80;
    const randomSpeed = isSpeaking ? 80 : 120;
    
    const h = Math.floor(Math.random() * (maxH - minH)) + minH;
    const w = Math.floor(Math.random() * (maxW - minW)) + minW;
    const opacity = isSpeaking ? 0.7 + Math.random() * 0.2 : 0.6 + Math.random() * 0.3;
    
    mouthRef.current.style.height = h + 'px';
    mouthRef.current.style.width = w + 'px';
    mouthRef.current.style.background = `rgba(210,105,30,${opacity})`;
    
    animationFrameRef.current = requestAnimationFrame(() => {
      setTimeout(() => animateMouth(), speed + Math.random() * randomSpeed);
    });
  };

  const animateEyes = () => {
    if ((!isAnimating && !isSpeaking) || !leftEyeRef.current || !rightEyeRef.current) return;
    
    const now = Date.now();
    const blinkInterval = isSpeaking ? 1500 + Math.random() * 2000 : 2000 + Math.random() * 3000;
    
    if (!blinkingRef.current && now - lastBlinkRef.current > blinkInterval) {
      blinkingRef.current = true;
      leftEyeRef.current.style.height = '6px';
      rightEyeRef.current.style.height = '6px';
      
      setTimeout(() => {
        if (leftEyeRef.current && rightEyeRef.current) {
          leftEyeRef.current.style.height = '36px';
          rightEyeRef.current.style.height = '36px';
          blinkingRef.current = false;
          lastBlinkRef.current = Date.now();
        }
      }, 120);
    }
    
    eyeAnimationFrameRef.current = requestAnimationFrame(() => animateEyes());
  };

  useEffect(() => {
    if (isAnimating || isSpeaking) {
      if (avatarRef.current) {
        avatarRef.current.classList.add(styles.speaking || 'speaking');
      }
      if (soundWavesRef.current) {
        soundWavesRef.current.classList.add('active');
      }
      animateMouth();
      animateEyes();
    } else {
      if (avatarRef.current) {
        avatarRef.current.classList.remove(styles.speaking || 'speaking');
      }
      if (soundWavesRef.current) {
        soundWavesRef.current.classList.remove('active');
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (eyeAnimationFrameRef.current) {
        cancelAnimationFrame(eyeAnimationFrameRef.current);
      }
      
      // Reset mouth and eyes
      if (mouthRef.current) {
        mouthRef.current.style.height = '22px';
        mouthRef.current.style.width = '50px';
        mouthRef.current.style.background = 'rgba(210,105,30,0.7)';
      }
      if (leftEyeRef.current && rightEyeRef.current) {
        leftEyeRef.current.style.height = '36px';
        rightEyeRef.current.style.height = '36px';
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (eyeAnimationFrameRef.current) {
        cancelAnimationFrame(eyeAnimationFrameRef.current);
      }
    };
  }, [isAnimating, isSpeaking]);

  return (
    <div style={{ 
      position: 'relative', 
      width: '120px', 
      height: '120px', 
      margin: '10px auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <style>
        {`
          .avatar-container {
            position: relative;
          }
          
          .avatar {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: linear-gradient(45deg, #ffdbac, #f1c27d);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
          }
          
          .avatar.speaking {
            transform: scale(1.05);
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
          }
          
          .sound-waves {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: none;
            pointer-events: none;
          }
          
          .sound-waves.active {
            display: block;
          }
          
          .wave {
            width: 140px;
            height: 140px;
            border: 2px solid rgba(102, 126, 234, 0.3);
            border-radius: 50%;
            position: absolute;
            animation: wave 1.5s infinite;
          }
          
          .wave:nth-child(2) {
            animation-delay: 0.5s;
          }
          
          .wave:nth-child(3) {
            animation-delay: 1s;
          }
          
          @keyframes wave {
            0% {
              transform: scale(0.8);
              opacity: 1;
            }
            100% {
              transform: scale(1.8);
              opacity: 0;
            }
          }
        `}
      </style>
      
      <div ref={soundWavesRef} className="sound-waves">
        <div className="wave"></div>
        <div className="wave"></div>
        <div className="wave"></div>
      </div>
      
      <div ref={avatarRef} className="avatar">
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            position: 'relative',
            width: '85px',
            height: '95px',
            background: '#ffe0b2',
            borderRadius: '80% 80% 80% 80%/90% 90% 100% 100%',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            zIndex: 2
          }}>
            {/* Hair */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '35px',
              background: 'linear-gradient(90deg,#3e2723 60%,#6d4c41 100%)',
              borderRadius: '45px 45px 30px 30px/40px 40px 30px 30px',
              zIndex: 3
            }}></div>
            
            {/* Eyebrows */}
            <div style={{
              position: 'absolute',
              left: '16px',
              top: '27px',
              width: '19px',
              height: '5px',
              background: '#6d4c41',
              borderRadius: '10px',
              transform: 'rotate(-8deg)'
            }}></div>
            <div style={{
              position: 'absolute',
              right: '16px',
              top: '27px',
              width: '19px',
              height: '5px',
              background: '#6d4c41',
              borderRadius: '10px',
              transform: 'rotate(8deg)'
            }}></div>
            
            {/* Eyes */}
            <div ref={leftEyeRef} style={{
              position: 'absolute',
              left: '19px',
              top: '40px',
              width: '18px',
              height: '18px',
              background: '#fff',
              borderRadius: '50%',
              border: '1px solid #333',
              overflow: 'hidden',
              zIndex: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'height 0.1s ease'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: '#333',
                borderRadius: '50%',
                marginLeft: '3px'
              }}></div>
            </div>
            
            <div ref={rightEyeRef} style={{
              position: 'absolute',
              right: '19px',
              top: '40px',
              width: '18px',
              height: '18px',
              background: '#fff',
              borderRadius: '50%',
              border: '1px solid #333',
              overflow: 'hidden',
              zIndex: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'height 0.1s ease'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: '#333',
                borderRadius: '50%',
                marginRight: '3px'
              }}></div>
            </div>
            
            {/* Nose */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '60px',
              width: '9px',
              height: '14px',
              background: '#f1c27d',
              borderRadius: '50% 50% 60% 60%/60% 60% 100% 100%',
              transform: 'translateX(-50%)'
            }}></div>
            
            {/* Cheeks */}
            <div style={{
              position: 'absolute',
              left: '9px',
              top: '64px',
              width: '11px',
              height: '7px',
              background: '#ffb6b6',
              borderRadius: '50%',
              opacity: 0.5
            }}></div>
            <div style={{
              position: 'absolute',
              right: '9px',
              top: '64px',
              width: '11px',
              height: '7px',
              background: '#ffb6b6',
              borderRadius: '50%',
              opacity: 0.5
            }}></div>
            
            {/* Mouth */}
            <div ref={mouthRef} style={{
              position: 'absolute',
              left: '50%',
              top: '79px',
              width: '25px',
              height: '11px',
              transform: 'translateX(-50%)',
              background: 'rgba(210,105,30,0.7)',
              borderRadius: '0 0 25px 25px',
              transition: 'all 0.1s ease',
              zIndex: 5
            }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Voice Reading Hook
const useVoiceReading = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis;
      
      const loadVoices = () => {
        const voices = synthesisRef.current?.getVoices() || [];
        console.log('Voices loaded:', voices.length);
        setAvailableVoices(voices);
        setVoicesLoaded(voices.length > 0);
      };

      // Load voices immediately
      loadVoices();
      
      // Also listen for voiceschanged event
      if (synthesisRef.current) {
        synthesisRef.current.addEventListener('voiceschanged', loadVoices);
      }
    } else {
      console.error('Speech synthesis not supported');
    }

    return () => {
      if (utteranceRef.current && synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, []);

  const stopSpeaking = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsSpeaking(false);
      utteranceRef.current = null;
      console.log('Speech stopped');
    }
  };

  const speakText = (text: string) => {
    console.log('speakText called:', { text: text.substring(0, 50), isVoiceEnabled, voicesLoaded });
    
    if (!synthesisRef.current || !isVoiceEnabled || !text) {
      console.log('Speech conditions not met');
      return;
    }

    // Stop any current speech
    stopSpeaking();

    // Clean the text exactly like the working example
    const cleanText = text
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1') // Remove code markdown
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/^\s*[-*+]\s/gm, '') // Remove bullet points
      .replace(/^\s*\d+\.\s/gm, '') // Remove numbered lists
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces
      .trim();

    if (!cleanText || cleanText.length < 2) {
      console.log('Text too short after cleaning');
      return;
    }

    console.log('Creating utterance for:', cleanText.substring(0, 50));

    try {
      utteranceRef.current = new SpeechSynthesisUtterance(cleanText);
      
      // Find and set a good voice (same logic as working example)
      const voices = availableVoices;
      if (voices.length > 0) {
        // Try to find a good English voice
        let selectedVoice = voices.find(voice => voice.lang.startsWith('en-US')) ||
                           voices.find(voice => voice.lang.startsWith('en')) ||
                           voices[0];
        
        if (selectedVoice) {
          utteranceRef.current.voice = selectedVoice;
          console.log('Selected voice:', selectedVoice.name);
        }
      }

      // Set parameters like the working example
      utteranceRef.current.rate = 1.0;
      utteranceRef.current.pitch = 1.0;
      utteranceRef.current.volume = 1.0;

      // Event listeners exactly like working example
      utteranceRef.current.onstart = () => {
        console.log('Speech started');
        setIsSpeaking(true);
      };

      utteranceRef.current.onend = () => {
        console.log('Speech ended');
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      utteranceRef.current.onerror = (event) => {
        console.error('Speech error:', event.error);
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      utteranceRef.current.onpause = () => {
        console.log('Speech paused');
        setIsSpeaking(false);
      };

      utteranceRef.current.onresume = () => {
        console.log('Speech resumed');
        setIsSpeaking(true);
      };

      // Speak the utterance
      console.log('Starting speech...');
      synthesisRef.current.speak(utteranceRef.current);

    } catch (error) {
      console.error('Error creating speech:', error);
      setIsSpeaking(false);
    }
  };

  const toggleVoice = () => {
    const newState = !isVoiceEnabled;
    console.log('Toggling voice:', newState);
    
    if (isVoiceEnabled && isSpeaking) {
      stopSpeaking();
    }
    
    setIsVoiceEnabled(newState);
    
    // Test speech when enabling (like the working example)
    if (newState && synthesisRef.current && voicesLoaded) {
      setTimeout(() => {
        console.log('Testing voice...');
        const testUtterance = new SpeechSynthesisUtterance('Voice enabled');
        testUtterance.volume = 0.7;
        testUtterance.rate = 1.0;
        
        // Set voice for test
        if (availableVoices.length > 0) {
          const testVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
          if (testVoice) {
            testUtterance.voice = testVoice;
          }
        }
        
        synthesisRef.current?.speak(testUtterance);
      }, 100);
    }
  };

  return {
    isSpeaking,
    isVoiceEnabled,
    voicesLoaded,
    availableVoices,
    speakText,
    stopSpeaking,
    toggleVoice
  };
};

const Chat = () => {
  const appStateContext = useContext(AppStateContext)
  const ui = appStateContext?.state.frontendSettings?.ui
  const AUTH_ENABLED = appStateContext?.state.frontendSettings?.auth_enabled
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [showLoadingMessage, setShowLoadingMessage] = useState<boolean>(false)
  const [activeCitation, setActiveCitation] = useState<Citation>()
  const [isCitationPanelOpen, setIsCitationPanelOpen] = useState<boolean>(false)
  const [isIntentsPanelOpen, setIsIntentsPanelOpen] = useState<boolean>(false)
  const abortFuncs = useRef([] as AbortController[])
  const [showAuthMessage, setShowAuthMessage] = useState<boolean | undefined>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [execResults, setExecResults] = useState<ExecResults[]>([])
  const [processMessages, setProcessMessages] = useState<messageStatus>(messageStatus.NotRunning)
  const [clearingChat, setClearingChat] = useState<boolean>(false)
  const [hideErrorDialog, { toggle: toggleErrorDialog }] = useBoolean(true)
  const [errorMsg, setErrorMsg] = useState<ErrorMessage | null>()
  const [logo, setLogo] = useState('')
  const [answerId, setAnswerId] = useState<string>('')

  // Voice reading functionality
  const { isSpeaking, isVoiceEnabled, voicesLoaded, availableVoices, speakText, stopSpeaking, toggleVoice } = useVoiceReading();
  const lastProcessedMessageRef = useRef<string>('');

  const errorDialogContentProps = {
    type: DialogType.close,
    title: errorMsg?.title,
    closeButtonAriaLabel: 'Close',
    subText: errorMsg?.subtitle
  }

  const modalProps = {
    titleAriaId: 'labelId',
    subtitleAriaId: 'subTextId',
    isBlocking: true,
    styles: { main: { maxWidth: 450 } }
  }

  const [ASSISTANT, TOOL, ERROR] = ['assistant', 'tool', 'error']
  const NO_CONTENT_ERROR = 'No content in messages object.'

  useEffect(() => {
    if (
      appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.Working &&
      appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured &&
      appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Fail &&
      hideErrorDialog
    ) {
      let subtitle = `${appStateContext.state.isCosmosDBAvailable.status}. Please contact the site administrator.`
      setErrorMsg({
        title: 'Chat history is not enabled',
        subtitle: subtitle
      })
      toggleErrorDialog()
    }
  }, [appStateContext?.state.isCosmosDBAvailable])

  // Effect to read new assistant messages - simplified like the working example
  useEffect(() => {
    if (!isVoiceEnabled || !voicesLoaded || messages.length === 0 || isLoading) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    
    if (
      lastMessage.role === ASSISTANT && 
      typeof lastMessage.content === 'string' && 
      lastMessage.content.trim().length > 0 &&
      lastMessage.id !== lastProcessedMessageRef.current
    ) {
      console.log('New assistant message detected, will speak:', lastMessage.id);
      lastProcessedMessageRef.current = lastMessage.id;
      
      // Use a longer delay to ensure message is fully rendered
      setTimeout(() => {
        speakText(lastMessage.content as string);
      }, 1000);
    }
  }, [messages, isVoiceEnabled, voicesLoaded, isLoading, speakText]);

  const handleErrorDialogClose = () => {
    toggleErrorDialog()
    setTimeout(() => {
      setErrorMsg(null)
    }, 500)
  }

  useEffect(() => {
    if (!appStateContext?.state.isLoading) {
      setLogo(ui?.chat_logo || ui?.logo || Contoso)
    }
  }, [appStateContext?.state.isLoading])

  useEffect(() => {
    setIsLoading(appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Loading)
  }, [appStateContext?.state.chatHistoryLoadingState])

  const getUserInfoList = async () => {
    if (!AUTH_ENABLED) {
      setShowAuthMessage(false)
      return
    }
    const userInfoList = await getUserInfo()
    if (userInfoList.length === 0 && window.location.hostname !== '127.0.0.1') {
      setShowAuthMessage(true)
    } else {
      setShowAuthMessage(false)
    }
  }

  let assistantMessage = {} as ChatMessage
  let toolMessage = {} as ChatMessage
  let assistantContent = ''

  useEffect(() => parseExecResults(execResults), [execResults])

  const parseExecResults = (exec_results_: any): void => {
    if (exec_results_ == undefined) return
    const exec_results = exec_results_.length === 2 ? exec_results_ : exec_results_.splice(2)
    appStateContext?.dispatch({ type: 'SET_ANSWER_EXEC_RESULT', payload: { answerId: answerId, exec_result: exec_results } })
  }

  const processResultMessage = (resultMessage: ChatMessage, userMessage: ChatMessage, conversationId?: string) => {
    if (typeof resultMessage.content === "string" && resultMessage.content.includes('all_exec_results')) {
      const parsedExecResults = JSON.parse(resultMessage.content) as AzureSqlServerExecResults
      setExecResults(parsedExecResults.all_exec_results)
      assistantMessage.context = JSON.stringify({
        all_exec_results: parsedExecResults.all_exec_results
      })
    }

    if (resultMessage.role === ASSISTANT) {
      setAnswerId(resultMessage.id)
      assistantContent += resultMessage.content
      assistantMessage = { ...assistantMessage, ...resultMessage }
      assistantMessage.content = assistantContent

      if (resultMessage.context) {
        toolMessage = {
          id: uuid(),
          role: TOOL,
          content: resultMessage.context,
          date: new Date().toISOString()
        }
      }
    }

    if (resultMessage.role === TOOL) toolMessage = resultMessage

    if (!conversationId) {
      isEmpty(toolMessage)
        ? setMessages([...messages, userMessage, assistantMessage])
        : setMessages([...messages, userMessage, toolMessage, assistantMessage])
    } else {
      isEmpty(toolMessage)
        ? setMessages([...messages, assistantMessage])
        : setMessages([...messages, toolMessage, assistantMessage])
    }
  }

  const makeApiRequestWithoutCosmosDB = async (question: ChatMessage["content"], conversationId?: string) => {
    setIsLoading(true)
    setShowLoadingMessage(true)
    if (isSpeaking) stopSpeaking(); // Stop any ongoing speech
    
    const abortController = new AbortController()
    abortFuncs.current.unshift(abortController)

    const questionContent = typeof question === 'string' ? question : [{ type: "text", text: question[0].text }, { type: "image_url", image_url: { url: question[1].image_url.url } }]
    question = typeof question !== 'string' && question[0]?.text?.length > 0 ? question[0].text : question

    const userMessage: ChatMessage = {
      id: uuid(),
      role: 'user',
      content: questionContent as string,
      date: new Date().toISOString()
    }

    let conversation: Conversation | null | undefined
    if (!conversationId) {
      conversation = {
        id: conversationId ?? uuid(),
        title: question as string,
        messages: [userMessage],
        date: new Date().toISOString()
      }
    } else {
      conversation = appStateContext?.state?.currentChat
      if (!conversation) {
        console.error('Conversation not found.')
        setIsLoading(false)
        setShowLoadingMessage(false)
        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
        return
      } else {
        conversation.messages.push(userMessage)
      }
    }

    appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: conversation })
    setMessages(conversation.messages)

    const request: ConversationRequest = {
      messages: [...conversation.messages.filter(answer => answer.role !== ERROR)]
    }

    let result = {} as ChatResponse
    try {
      const response = await conversationApi(request, abortController.signal)
      if (response?.body) {
        const reader = response.body.getReader()

        let runningText = ''
        while (true) {
          setProcessMessages(messageStatus.Processing)
          const { done, value } = await reader.read()
          if (done) break

          var text = new TextDecoder('utf-8').decode(value)
          const objects = text.split('\n')
          objects.forEach(obj => {
            try {
              if (obj !== '' && obj !== '{}') {
                runningText += obj
                result = JSON.parse(runningText)
                if (result.choices?.length > 0) {
                  result.choices[0].messages.forEach(msg => {
                    msg.id = result.id
                    msg.date = new Date().toISOString()
                  })
                  if (result.choices[0].messages?.some(m => m.role === ASSISTANT)) {
                    setShowLoadingMessage(false)
                  }
                  result.choices[0].messages.forEach(resultObj => {
                    processResultMessage(resultObj, userMessage, conversationId)
                  })
                } else if (result.error) {
                  throw Error(result.error)
                }
                runningText = ''
              }
            } catch (e) {
              if (!(e instanceof SyntaxError)) {
                console.error(e)
                throw e
              } else {
                console.log('Incomplete message. Continuing...')
              }
            }
          })
        }
        conversation.messages.push(toolMessage, assistantMessage)
        appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: conversation })
        setMessages([...messages, toolMessage, assistantMessage])
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        let errorMessage =
          'An error occurred. Please try again. If the problem persists, please contact the site administrator.'
        if (result.error?.message) {
          errorMessage = result.error.message
        } else if (typeof result.error === 'string') {
          errorMessage = result.error
        }

        errorMessage = parseErrorMessage(errorMessage)

        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: ERROR,
          content: errorMessage,
          date: new Date().toISOString()
        }
        conversation.messages.push(errorChatMsg)
        appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: conversation })
        setMessages([...messages, errorChatMsg])
      } else {
        setMessages([...messages, userMessage])
      }
    } finally {
      setIsLoading(false)
      setShowLoadingMessage(false)
      abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
      setProcessMessages(messageStatus.Done)
    }

    return abortController.abort()
  }

  const makeApiRequestWithCosmosDB = async (question: ChatMessage["content"], conversationId?: string) => {
    setIsLoading(true)
    setShowLoadingMessage(true)
    if (isSpeaking) stopSpeaking(); // Stop any ongoing speech
    
    const abortController = new AbortController()
    abortFuncs.current.unshift(abortController)
    const questionContent = typeof question === 'string' ? question : [{ type: "text", text: question[0].text }, { type: "image_url", image_url: { url: question[1].image_url.url } }]
    question = typeof question !== 'string' && question[0]?.text?.length > 0 ? question[0].text : question

    const userMessage: ChatMessage = {
      id: uuid(),
      role: 'user',
      content: questionContent as string,
      date: new Date().toISOString()
    }

    let request: ConversationRequest
    let conversation
    if (conversationId) {
      conversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
      if (!conversation) {
        console.error('Conversation not found.')
        setIsLoading(false)
        setShowLoadingMessage(false)
        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
        return
      } else {
        conversation.messages.push(userMessage)
        request = {
          messages: [...conversation.messages.filter(answer => answer.role !== ERROR)]
        }
      }
    } else {
      request = {
        messages: [userMessage].filter(answer => answer.role !== ERROR)
      }
      setMessages(request.messages)
    }
    let result = {} as ChatResponse
    var errorResponseMessage = 'Please try again. If the problem persists, please contact the site administrator.'
    try {
      const response = conversationId
        ? await historyGenerate(request, abortController.signal, conversationId)
        : await historyGenerate(request, abortController.signal)
      if (!response?.ok) {
        const responseJson = await response.json()
        errorResponseMessage =
          responseJson.error === undefined ? errorResponseMessage : parseErrorMessage(responseJson.error)
        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: ERROR,
          content: `There was an error generating a response. Chat history can't be saved at this time. ${errorResponseMessage}`,
          date: new Date().toISOString()
        }
        let resultConversation
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
          if (!resultConversation) {
            console.error('Conversation not found.')
            setIsLoading(false)
            setShowLoadingMessage(false)
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
            return
          }
          resultConversation.messages.push(errorChatMsg)
        } else {
          setMessages([...messages, userMessage, errorChatMsg])
          setIsLoading(false)
          setShowLoadingMessage(false)
          abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
          return
        }
        appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: resultConversation })
        setMessages([...resultConversation.messages])
        return
      }
      if (response?.body) {
        const reader = response.body.getReader()

        let runningText = ''
        while (true) {
          setProcessMessages(messageStatus.Processing)
          const { done, value } = await reader.read()
          if (done) break

          var text = new TextDecoder('utf-8').decode(value)
          const objects = text.split('\n')
          objects.forEach(obj => {
            try {
              if (obj !== '' && obj !== '{}') {
                runningText += obj
                result = JSON.parse(runningText)
                if (!result.choices?.[0]?.messages?.[0].content) {
                  errorResponseMessage = NO_CONTENT_ERROR
                  throw Error()
                }
                if (result.choices?.length > 0) {
                  result.choices[0].messages.forEach(msg => {
                    msg.id = result.id
                    msg.date = new Date().toISOString()
                  })
                  if (result.choices[0].messages?.some(m => m.role === ASSISTANT)) {
                    setShowLoadingMessage(false)
                  }
                  result.choices[0].messages.forEach(resultObj => {
                    processResultMessage(resultObj, userMessage, conversationId)
                  })
                }
                runningText = ''
              } else if (result.error) {
                throw Error(result.error)
              }
            } catch (e) {
              if (!(e instanceof SyntaxError)) {
                console.error(e)
                throw e
              } else {
                console.log('Incomplete message. Continuing...')
              }
            }
          })
        }

        let resultConversation
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
          if (!resultConversation) {
            console.error('Conversation not found.')
            setIsLoading(false)
            setShowLoadingMessage(false)
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
            return
          }
          isEmpty(toolMessage)
            ? resultConversation.messages.push(assistantMessage)
            : resultConversation.messages.push(toolMessage, assistantMessage)
        } else {
          resultConversation = {
            id: result.history_metadata.conversation_id,
            title: result.history_metadata.title,
            messages: [userMessage],
            date: result.history_metadata.date
          }
          isEmpty(toolMessage)
            ? resultConversation.messages.push(assistantMessage)
            : resultConversation.messages.push(toolMessage, assistantMessage)
        }
        if (!resultConversation) {
          setIsLoading(false)
          setShowLoadingMessage(false)
          abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
          return
        }
        appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: resultConversation })
        isEmpty(toolMessage)
          ? setMessages([...messages, assistantMessage])
          : setMessages([...messages, toolMessage, assistantMessage])
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        let errorMessage = `An error occurred. ${errorResponseMessage}`
        if (result.error?.message) {
          errorMessage = result.error.message
        } else if (typeof result.error === 'string') {
          errorMessage = result.error
        }

        errorMessage = parseErrorMessage(errorMessage)

        let errorChatMsg: ChatMessage = {
          id: uuid(),
          role: ERROR,
          content: errorMessage,
          date: new Date().toISOString()
        }
        let resultConversation
        if (conversationId) {
          resultConversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
          if (!resultConversation) {
            console.error('Conversation not found.')
            setIsLoading(false)
            setShowLoadingMessage(false)
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
            return
          }
          resultConversation.messages.push(errorChatMsg)
        } else {
          if (!result.history_metadata) {
            console.error('Error retrieving data.', result)
            let errorChatMsg: ChatMessage = {
              id: uuid(),
              role: ERROR,
              content: errorMessage,
              date: new Date().toISOString()
            }
            setMessages([...messages, userMessage, errorChatMsg])
            setIsLoading(false)
            setShowLoadingMessage(false)
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
            return
          }
          resultConversation = {
            id: result.history_metadata.conversation_id,
            title: result.history_metadata.title,
            messages: [userMessage],
            date: result.history_metadata.date
          }
          resultConversation.messages.push(errorChatMsg)
        }
        if (!resultConversation) {
          setIsLoading(false)
          setShowLoadingMessage(false)
          abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
          return
        }
        appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: resultConversation })
        setMessages([...messages, errorChatMsg])
      } else {
        setMessages([...messages, userMessage])
      }
    } finally {
      setIsLoading(false)
      setShowLoadingMessage(false)
      abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
      setProcessMessages(messageStatus.Done)
    }
    return abortController.abort()
  }

  const clearChat = async () => {
    setClearingChat(true)
    if (isSpeaking) stopSpeaking(); // Stop any ongoing speech
    
    if (appStateContext?.state.currentChat?.id && appStateContext?.state.isCosmosDBAvailable.cosmosDB) {
      let response = await historyClear(appStateContext?.state.currentChat.id)
      if (!response.ok) {
        setErrorMsg({
          title: 'Error clearing current chat',
          subtitle: 'Please try again. If the problem persists, please contact the site administrator.'
        })
        toggleErrorDialog()
      } else {
        appStateContext?.dispatch({
          type: 'DELETE_CURRENT_CHAT_MESSAGES',
          payload: appStateContext?.state.currentChat.id
        })
        appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY', payload: appStateContext?.state.currentChat })
        setActiveCitation(undefined)
        setIsCitationPanelOpen(false)
        setIsIntentsPanelOpen(false)
        setMessages([])
      }
    }
    setClearingChat(false)
  }

  const tryGetRaiPrettyError = (errorMessage: string) => {
    try {
      // Using a regex to extract the JSON part that contains "innererror"
      const match = errorMessage.match(/'innererror': ({.*})\}\}/)
      if (match) {
        // Replacing single quotes with double quotes and converting Python-like booleans to JSON booleans
        const fixedJson = match[1]
          .replace(/'/g, '"')
          .replace(/\bTrue\b/g, 'true')
          .replace(/\bFalse\b/g, 'false')
        const innerErrorJson = JSON.parse(fixedJson)
        let reason = ''
        // Check if jailbreak content filter is the reason of the error
        const jailbreak = innerErrorJson.content_filter_result.jailbreak
        if (jailbreak.filtered === true) {
          reason = 'Jailbreak'
        }

        // Returning the prettified error message
        if (reason !== '') {
          return (
            'The prompt was filtered due to triggering Azure OpenAI\'s content filtering system.\n' +
            'Reason: This prompt contains content flagged as ' +
            reason +
            '\n\n' +
            'Please modify your prompt and retry. Learn more: https://go.microsoft.com/fwlink/?linkid=2198766'
          )
        }
      }
    } catch (e) {
      console.error('Failed to parse the error:', e)
    }
    return errorMessage
  }

  const parseErrorMessage = (errorMessage: string) => {
    let errorCodeMessage = errorMessage.substring(0, errorMessage.indexOf('-') + 1)
    const innerErrorCue = "{\\'error\\': {\\'message\\': "
    if (errorMessage.includes(innerErrorCue)) {
      try {
        let innerErrorString = errorMessage.substring(errorMessage.indexOf(innerErrorCue))
        if (innerErrorString.endsWith("'}}")) {
          innerErrorString = innerErrorString.substring(0, innerErrorString.length - 3)
        }
        innerErrorString = innerErrorString.replaceAll("\\'", "'")
        let newErrorMessage = errorCodeMessage + ' ' + innerErrorString
        errorMessage = newErrorMessage
      } catch (e) {
        console.error('Error parsing inner error message: ', e)
      }
    }

    return tryGetRaiPrettyError(errorMessage)
  }

  const newChat = () => {
    setProcessMessages(messageStatus.Processing)
    setMessages([])
    setIsCitationPanelOpen(false)
    setIsIntentsPanelOpen(false)
    setActiveCitation(undefined)
    appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: null })
    setProcessMessages(messageStatus.Done)
    if (isSpeaking) stopSpeaking(); // Stop any ongoing speech
  }

  const stopGenerating = () => {
    abortFuncs.current.forEach(a => a.abort())
    setShowLoadingMessage(false)
    setIsLoading(false)
    if (isSpeaking) stopSpeaking(); // Stop any ongoing speech
  }

  useEffect(() => {
    if (appStateContext?.state.currentChat) {
      setMessages(appStateContext.state.currentChat.messages)
    } else {
      setMessages([])
    }
  }, [appStateContext?.state.currentChat])

  useLayoutEffect(() => {
    const saveToDB = async (messages: ChatMessage[], id: string) => {
      const response = await historyUpdate(messages, id)
      return response
    }

    if (appStateContext && appStateContext.state.currentChat && processMessages === messageStatus.Done) {
      if (appStateContext.state.isCosmosDBAvailable.cosmosDB) {
        if (!appStateContext?.state.currentChat?.messages) {
          console.error('Failure fetching current chat state.')
          return
        }
        const noContentError = appStateContext.state.currentChat.messages.find(m => m.role === ERROR)

        if (!noContentError) {
          saveToDB(appStateContext.state.currentChat.messages, appStateContext.state.currentChat.id)
            .then(res => {
              if (!res.ok) {
                let errorMessage =
                  "An error occurred. Answers can't be saved at this time. If the problem persists, please contact the site administrator."
                let errorChatMsg: ChatMessage = {
                  id: uuid(),
                  role: ERROR,
                  content: errorMessage,
                  date: new Date().toISOString()
                }
                if (!appStateContext?.state.currentChat?.messages) {
                  let err: Error = {
                    ...new Error(),
                    message: 'Failure fetching current chat state.'
                  }
                  throw err
                }
                setMessages([...appStateContext?.state.currentChat?.messages, errorChatMsg])
              }
              return res as Response
            })
            .catch(err => {
              console.error('Error: ', err)
              let errRes: Response = {
                ...new Response(),
                ok: false,
                status: 500
              }
              return errRes
            })
        }
      } else {
      }
      appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY', payload: appStateContext.state.currentChat })
      setMessages(appStateContext.state.currentChat.messages)
      setProcessMessages(messageStatus.NotRunning)
    }
  }, [processMessages])

  useEffect(() => {
    if (AUTH_ENABLED !== undefined) getUserInfoList()
  }, [AUTH_ENABLED])

  useLayoutEffect(() => {
    chatMessageStreamEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [showLoadingMessage, processMessages])

  const onShowCitation = (citation: Citation) => {
    setActiveCitation(citation)
    setIsCitationPanelOpen(true)
  }

  const onShowExecResult = (answerId: string) => {
    setIsIntentsPanelOpen(true)
  }

  const onViewSource = (citation: Citation) => {
    if (citation.url && !citation.url.includes('blob.core')) {
      window.open(citation.url, '_blank')
    }
  }

  const parseCitationFromMessage = (message: ChatMessage) => {
    if (message?.role && message?.role === 'tool' && typeof message?.content === "string") {
      try {
        const toolMessage = JSON.parse(message.content) as ToolMessageContent
        return toolMessage.citations
      } catch {
        return []
      }
    }
    return []
  }

  const parsePlotFromMessage = (message: ChatMessage) => {
    if (message?.role && message?.role === "tool" && typeof message?.content === "string") {
      try {
        const execResults = JSON.parse(message.content) as AzureSqlServerExecResults;
        const codeExecResult = execResults.all_exec_results.at(-1)?.code_exec_result;

        if (codeExecResult === undefined) {
          return null;
        }
        return codeExecResult.toString();
      }
      catch {
        return null;
      }
    }
    return null;
  }

  const disabledButton = () => {
    return (
      isLoading ||
      (messages && messages.length === 0) ||
      clearingChat ||
      appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Loading
    )
  }

  return (
    <div className={styles.container} role="main">
      {showAuthMessage ? (
        <Stack className={styles.chatEmptyState}>
          <ShieldLockRegular
            className={styles.chatIcon}
            style={{ color: 'darkorange', height: '200px', width: '200px' }}
          />
          <h1 className={styles.chatEmptyStateTitle}>Authentication Not Configured</h1>
          <h2 className={styles.chatEmptyStateSubtitle}>
            This app does not have authentication configured. Please add an identity provider by finding your app in the{' '}
            <a href="https://portal.azure.com/" target="_blank">
              Azure Portal
            </a>
            and following{' '}
            <a
              href="https://learn.microsoft.com/en-us/azure/app-service/scenario-secure-app-authentication-app-service#3-configure-authentication-and-authorization"
              target="_blank">
              these instructions
            </a>
            .
          </h2>
          <h2 className={styles.chatEmptyStateSubtitle} style={{ fontSize: '20px' }}>
            <strong>Authentication configuration takes a few minutes to apply. </strong>
          </h2>
          <h2 className={styles.chatEmptyStateSubtitle} style={{ fontSize: '20px' }}>
            <strong>If you deployed in the last 10 minutes, please wait and reload the page after 10 minutes.</strong>
          </h2>
        </Stack>
      ) : (
        <Stack horizontal className={styles.chatRoot}>
          <div className={styles.chatContainer}>
            {!messages || messages.length < 1 ? (
              <Stack className={styles.chatEmptyState}>
                <img src={logo} className={styles.chatIcon} aria-hidden="true" />
                <AnimatedAvatar isAnimating={false} isSpeaking={false} />
                <h1 className={styles.chatEmptyStateTitle}>{ui?.chat_title}</h1>
                <h2 className={styles.chatEmptyStateSubtitle}>{ui?.chat_description}</h2>
              </Stack>
            ) : (
              <div className={styles.chatMessageStream} style={{ marginBottom: isLoading ? '40px' : '0px' }} role="log">
                {messages.map((answer, index) => (
                  <>
                    {answer.role === 'user' ? (
                      <div className={styles.chatMessageUser} tabIndex={0}>
                        <div className={styles.chatMessageUserMessage}>
                          {typeof answer.content === "string" && answer.content ? answer.content : Array.isArray(answer.content) ? <>{answer.content[0].text} <img className={styles.uploadedImageChat} src={answer.content[1].image_url.url} alt="Uploaded Preview" /></> : null}
                        </div>
                      </div>
                    ) : answer.role === 'assistant' ? (
                      <div className={styles.chatMessageGpt}>
                        <AnimatedAvatar 
                          isAnimating={isLoading && index === messages.length - 1} 
                          isSpeaking={isSpeaking && index === messages.length - 1}
                        />
                        {typeof answer.content === "string" && <Answer
                          answer={{
                            answer: answer.content,
                            citations: parseCitationFromMessage(messages[index - 1]),
                            generated_chart: parsePlotFromMessage(messages[index - 1]),
                            message_id: answer.id,
                            feedback: answer.feedback,
                            exec_results: execResults
                          }}
                          onCitationClicked={c => onShowCitation(c)}
                          onExectResultClicked={() => onShowExecResult(answerId)}
                        />}
                      </div>
                    ) : answer.role === ERROR ? (
                      <div className={styles.chatMessageError}>
                        <Stack horizontal className={styles.chatMessageErrorContent}>
                          <ErrorCircleRegular className={styles.errorIcon} style={{ color: 'rgba(182, 52, 67, 1)' }} />
                          <span>Error</span>
                        </Stack>
                        <span className={styles.chatMessageErrorContent}>{typeof answer.content === "string" && answer.content}</span>
                      </div>
                    ) : null}
                  </>
                ))}
                {showLoadingMessage && (
                  <>
                    <div className={styles.chatMessageGpt}>
                      <AnimatedAvatar isAnimating={true} isSpeaking={false} />
                      <Answer
                        answer={{
                          answer: "Generating answer...",
                          citations: [],
                          generated_chart: null
                        }}
                        onCitationClicked={() => null}
                        onExectResultClicked={() => null}
                      />
                    </div>
                  </>
                )}
                <div ref={chatMessageStreamEnd} />
              </div>
            )}

            <Stack horizontal className={styles.chatInput}>
              {isLoading && messages.length > 0 && (
                <Stack
                  horizontal
                  className={styles.stopGeneratingContainer}
                  role="button"
                  aria-label="Stop generating"
                  tabIndex={0}
                  onClick={stopGenerating}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ' ? stopGenerating() : null)}>
                  <SquareRegular className={styles.stopGeneratingIcon} aria-hidden="true" />
                  <span className={styles.stopGeneratingText} aria-hidden="true">
                    Stop generating
                  </span>
                </Stack>
              )}
              <Stack>
                {/* Voice Toggle Button */}
                <CommandBarButton
                  role="button"
                  styles={{
                    icon: {
                      color: isVoiceEnabled ? '#FFFFFF' : '#666666'
                    },
                    iconDisabled: {
                      color: '#BDBDBD !important'
                    },
                    root: {
                      color: isVoiceEnabled ? '#FFFFFF' : '#666666',
                      background: isVoiceEnabled
                        ? 'radial-gradient(109.81% 107.82% at 100.1% 90.19%, #0F6CBD 33.63%, #2D87C3 70.31%, #8DDDD8 100%)'
                        : '#F0F0F0',
                      border: isSpeaking ? '2px solid #00ff00' : 'none'
                    },
                    rootDisabled: {
                      background: '#F0F0F0'
                    }
                  }}
                  className={styles.newChatIcon}
                  iconProps={{ 
                    iconName: isVoiceEnabled 
                      ? (isSpeaking ? 'MicrophoneType' : 'Volume3') 
                      : 'VolumeDisabled'
                  }}
                  onClick={toggleVoice}
                  disabled={false}
                  aria-label={isVoiceEnabled ? "Disable voice reading" : "Enable voice reading"}
                  title={
                    isVoiceEnabled 
                      ? (isSpeaking ? "Speaking... (click to disable voice)" : "Voice reading enabled (click to disable)")
                      : "Voice reading disabled (click to enable)"
                  }
                />
                {appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured && (
                  <CommandBarButton
                    role="button"
                    styles={{
                      icon: {
                        color: '#FFFFFF'
                      },
                      iconDisabled: {
                        color: '#BDBDBD !important'
                      },
                      root: {
                        color: '#FFFFFF',
                        background:
                          'radial-gradient(109.81% 107.82% at 100.1% 90.19%, #0F6CBD 33.63%, #2D87C3 70.31%, #8DDDD8 100%)'
                      },
                      rootDisabled: {
                        background: '#F0F0F0'
                      }
                    }}
                    className={styles.newChatIcon}
                    iconProps={{ iconName: 'Add' }}
                    onClick={newChat}
                    disabled={disabledButton()}
                    aria-label="start a new chat button"
                  />
                )}
                <CommandBarButton
                  role="button"
                  styles={{
                    icon: {
                      color: '#FFFFFF'
                    },
                    iconDisabled: {
                      color: '#BDBDBD !important'
                    },
                    root: {
                      color: '#FFFFFF',
                      background:
                        'radial-gradient(109.81% 107.82% at 100.1% 90.19%, #0F6CBD 33.63%, #2D87C3 70.31%, #8DDDD8 100%)'
                    },
                    rootDisabled: {
                      background: '#F0F0F0'
                    }
                  }}
                  className={
                    appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured
                      ? styles.clearChatBroom
                      : styles.clearChatBroomNoCosmos
                  }
                  iconProps={{ iconName: 'Broom' }}
                  onClick={
                    appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured
                      ? clearChat
                      : newChat
                  }
                  disabled={disabledButton()}
                  aria-label="clear chat button"
                />
                <Dialog
                  hidden={hideErrorDialog}
                  onDismiss={handleErrorDialogClose}
                  dialogContentProps={errorDialogContentProps}
                  modalProps={modalProps}></Dialog>
              </Stack>
              <QuestionInput
                clearOnSend
                placeholder="Type a new question..."
                disabled={isLoading}
                onSend={(question, id) => {
                  appStateContext?.state.isCosmosDBAvailable?.cosmosDB
                    ? makeApiRequestWithCosmosDB(question, id)
                    : makeApiRequestWithoutCosmosDB(question, id)
                }}
                conversationId={
                  appStateContext?.state.currentChat?.id ? appStateContext?.state.currentChat?.id : undefined
                }
              />
            </Stack>
          </div>
          {/* Citation Panel */}
          {messages && messages.length > 0 && isCitationPanelOpen && activeCitation && (
            <Stack.Item className={styles.citationPanel} tabIndex={0} role="tabpanel" aria-label="Citations Panel">
              <Stack
                aria-label="Citations Panel Header Container"
                horizontal
                className={styles.citationPanelHeaderContainer}
                horizontalAlign="space-between"
                verticalAlign="center">
                <span aria-label="Citations" className={styles.citationPanelHeader}>
                  Citations
                </span>
                <IconButton
                  iconProps={{ iconName: 'Cancel' }}
                  aria-label="Close citations panel"
                  onClick={() => setIsCitationPanelOpen(false)}
                />
              </Stack>
              <h5
                className={styles.citationPanelTitle}
                tabIndex={0}
                title={
                  activeCitation.url && !activeCitation.url.includes('blob.core')
                    ? activeCitation.url
                    : activeCitation.title ?? ''
                }
                onClick={() => onViewSource(activeCitation)}>
                {activeCitation.title}
              </h5>
              <div tabIndex={0}>
                <ReactMarkdown
                  linkTarget="_blank"
                  className={styles.citationPanelContent}
                  children={DOMPurify.sanitize(activeCitation.content, { ALLOWED_TAGS: XSSAllowTags })}
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                />
              </div>
            </Stack.Item>
          )}
          {messages && messages.length > 0 && isIntentsPanelOpen && (
            <Stack.Item className={styles.citationPanel} tabIndex={0} role="tabpanel" aria-label="Intents Panel">
              <Stack
                aria-label="Intents Panel Header Container"
                horizontal
                className={styles.citationPanelHeaderContainer}
                horizontalAlign="space-between"
                verticalAlign="center">
                <span aria-label="Intents" className={styles.citationPanelHeader}>
                  Intents
                </span>
                <IconButton
                  iconProps={{ iconName: 'Cancel' }}
                  aria-label="Close intents panel"
                  onClick={() => setIsIntentsPanelOpen(false)}
                />
              </Stack>
              <Stack horizontalAlign="space-between">
                {appStateContext?.state?.answerExecResult[answerId]?.map((execResult: ExecResults, index) => (
                  <Stack className={styles.exectResultList} verticalAlign="space-between">
                    <><span>Intent:</span> <p>{execResult.intent}</p></>
                    {execResult.search_query && <><span>Search Query:</span>
                      <SyntaxHighlighter
                        style={nord}
                        wrapLines={true}
                        lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
                        language="sql"
                        PreTag="p">
                        {execResult.search_query}
                      </SyntaxHighlighter></>}
                    {execResult.search_result && <><span>Search Result:</span> <p>{execResult.search_result}</p></>}
                    {execResult.code_generated && <><span>Code Generated:</span>
                      <SyntaxHighlighter
                        style={nord}
                        wrapLines={true}
                        lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
                        language="python"
                        PreTag="p">
                        {execResult.code_generated}
                      </SyntaxHighlighter>
                    </>}
                  </Stack>
                ))}
              </Stack>
            </Stack.Item>
          )}
          {appStateContext?.state.isChatHistoryOpen &&
            appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured && <ChatHistoryPanel />}
        </Stack>
      )}
    </div>
  )
}

export default Chat
