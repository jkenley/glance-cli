import { ElevenLabsClient } from 'elevenlabs';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import chalk from 'chalk';

interface VoiceOptions {
    voice?: string;
    model?: string;
    apiKey?: string;
    outputFile?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speakerBoost?: boolean;
    language?: string;
}

interface VoiceResult {
    success: boolean;
    outputFile?: string;
    error?: string;
}

// Language-specific voice mappings for natural pronunciation
const LANGUAGE_VOICES = {
    // English voices (default)
    'en': {
        'alloy': '21m00Tcm4TlvDq8ikWAM',      // Rachel - warm, friendly
        'echo': 'jsCqWAovK2LkecY7zXl4',       // Clyde - professional
        'nova': 'IKne3meq5aSn9XLyUdCD',       // Charlie - energetic
        'shimmer': 'LcfcDJNUP1GQjkzn1xUU',    // Charlotte - clear
        'onyx': 'N2lVS1w4EtoT3dr4eOWO',       // Callum - deep, authoritative
        'fable': 'jBpfuIE2acCO8z3wKNLl',      // Gigi - expressive
        'default': '21m00Tcm4TlvDq8ikWAM'     // Rachel as default
    },
    // French voices
    'fr': {
        'antoine': 'ErXwobaYiN019PkySvjV',     // French male, natural
        'charlotte': 'XB0fDUnXU5powFXDhCwa',   // French female, clear
        'henri': 'qhFERWI2CUBNq3XOLfRE',      // French male, professional
        'marie': 'VR6AewLTigWG4xSOukaG',      // French female, warm
        'default': 'XB0fDUnXU5powFXDhCwa'     // Charlotte as default
    },
    // Spanish voices  
    'es': {
        'antonio': 'gcLjJkVW4MZ7xQjpwQrO',    // Spanish male, neutral
        'isabella': 'TxGEqnHWrfWFTfGW9XjX',   // Spanish female, clear
        'pablo': 'flq6f7yk4E4fJM5XTYuZ',      // Spanish male, energetic
        'sofia': 'pMsXgVXv3BLzUgSXRplE',      // Spanish female, professional
        'default': 'TxGEqnHWrfWFTfGW9XjX'     // Isabella as default
    },
    // Haitian Creole (fallback to English with adjusted settings)
    'ht': {
        'default': '21m00Tcm4TlvDq8ikWAM'     // Rachel with slower speech
    }
};

// Fallback English voices for compatibility
const DEFAULT_VOICES = {
    'alloy': '21m00Tcm4TlvDq8ikWAM',      // Rachel (default)
    'echo': 'jsCqWAovK2LkecY7zXl4',       // Clyde
    'nova': 'IKne3meq5aSn9XLyUdCD',       // Charlie
    'shimmer': 'LcfcDJNUP1GQjkzn1xUU',    // Charlotte
    'onyx': 'N2lVS1w4EtoT3dr4eOWO',       // Callum
    'fable': 'jBpfuIE2acCO8z3wKNLl',      // Gigi
} as const;

// ElevenLabs models optimized for different languages
const LANGUAGE_MODELS = {
    'en': 'eleven_monolingual_v1',    // English optimized
    'fr': 'eleven_multilingual_v2',   // Multilingual for French
    'es': 'eleven_multilingual_v2',   // Multilingual for Spanish  
    'ht': 'eleven_multilingual_v2',   // Multilingual for Haitian Creole
    'default': 'eleven_monolingual_v1'
};

export class VoiceSynthesizer {
    private client?: ElevenLabsClient;
    private apiKey?: string;
    
    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY;
        
        if (this.apiKey) {
            this.client = new ElevenLabsClient({
                apiKey: this.apiKey
            });
        }
    }
    
    async synthesize(text: string, options: VoiceOptions = {}): Promise<VoiceResult> {
        // Clean text for speech
        const cleanText = this.cleanTextForSpeech(text);
        
        // Try ElevenLabs first if API key is available
        if (this.client && this.apiKey) {
            try {
                return await this.synthesizeWithElevenLabs(cleanText, options);
            } catch (error) {
                console.warn(chalk.yellow('⚠️  ElevenLabs failed, falling back to local TTS'));
                console.error(error);
            }
        }
        
        // Fallback to local TTS
        return await this.synthesizeWithLocalTTS(cleanText, options);
    }
    
    async synthesizeCleanedText(cleanedText: string, options: VoiceOptions = {}): Promise<VoiceResult> {
        // Use the already cleaned text directly (skip cleaning step)
        
        // Try ElevenLabs first if API key is available
        if (this.client && this.apiKey) {
            try {
                return await this.synthesizeWithElevenLabs(cleanedText, options);
            } catch (error) {
                console.warn(chalk.yellow('⚠️  ElevenLabs failed, falling back to local TTS'));
                console.error(error);
            }
        }
        
        // Fallback to local TTS
        return await this.synthesizeWithLocalTTS(cleanedText, options);
    }
    
    private async synthesizeWithElevenLabs(text: string, options: VoiceOptions): Promise<VoiceResult> {
        if (!this.client) {
            throw new Error('ElevenLabs client not initialized');
        }
        
        try {
            // Get optimal voice and model for language
            const { voiceId, model, voiceSettings } = this.getOptimalVoiceConfig(options);
            
            // Generate audio
            const audioStream = await this.client.generate({
                voice: voiceId,
                text,
                model_id: model,
                voice_settings: voiceSettings
            });
            
            // Convert stream to buffer
            const chunks: Buffer[] = [];
            for await (const chunk of audioStream) {
                chunks.push(Buffer.from(chunk));
            }
            const audioBuffer = Buffer.concat(chunks);
            
            // Save to file
            const outputPath = options.outputFile || join(tmpdir(), `glance-audio-${Date.now()}.mp3`);
            await writeFile(outputPath, audioBuffer);
            
            // Play audio if no output file specified (temp file)
            if (!options.outputFile) {
                await this.playAudio(outputPath);
                // Clean up temp file after playing
                setTimeout(() => unlink(outputPath).catch(() => {}), 5000);
            }
            
            return { 
                success: true, 
                outputFile: outputPath 
            };
            
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    
    private async synthesizeWithLocalTTS(text: string, options: VoiceOptions): Promise<VoiceResult> {
        const platform = process.platform;
        
        try {
            if (platform === 'darwin') {
                // macOS: Use 'say' command
                return await this.useMacOSSay(text, options);
            } else if (platform === 'win32') {
                // Windows: Use PowerShell
                return await this.useWindowsTTS(text, options);
            } else {
                // Linux: Try espeak or festival
                return await this.useLinuxTTS(text, options);
            }
        } catch (error) {
            return {
                success: false,
                error: `Local TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    
    private async useMacOSSay(text: string, options: VoiceOptions): Promise<VoiceResult> {
        return new Promise((resolve) => {
            const args: string[] = [];
            
            // Add voice if specified
            if (options.voice) {
                args.push('-v', options.voice);
            }
            
            // Add output file if specified
            if (options.outputFile) {
                args.push('-o', options.outputFile);
            }
            
            // Add the text
            args.push(text);
            
            const proc = spawn('say', args);
            
            proc.on('error', (error) => {
                resolve({
                    success: false,
                    error: `macOS say command failed: ${error.message}`
                });
            });
            
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        outputFile: options.outputFile
                    });
                } else {
                    resolve({
                        success: false,
                        error: `macOS say command exited with code ${code}`
                    });
                }
            });
        });
    }
    
    private async useWindowsTTS(text: string, options: VoiceOptions): Promise<VoiceResult> {
        return new Promise((resolve) => {
            const script = `
                Add-Type -AssemblyName System.Speech
                $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
                ${options.outputFile ? `$synthesizer.SetOutputToWaveFile("${options.outputFile}")` : ''}
                $synthesizer.Speak("${text.replace(/"/g, '""')}")
            `;
            
            const proc = spawn('powershell', ['-Command', script]);
            
            proc.on('error', (error) => {
                resolve({
                    success: false,
                    error: `Windows TTS failed: ${error.message}`
                });
            });
            
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        outputFile: options.outputFile
                    });
                } else {
                    resolve({
                        success: false,
                        error: `Windows TTS exited with code ${code}`
                    });
                }
            });
        });
    }
    
    private async useLinuxTTS(text: string, options: VoiceOptions): Promise<VoiceResult> {
        // Try espeak first
        return new Promise((resolve) => {
            const args: string[] = [];
            
            // Add output file if specified
            if (options.outputFile) {
                args.push('-w', options.outputFile);
            }
            
            // Add the text
            args.push(text);
            
            const proc = spawn('espeak', args);
            
            proc.on('error', () => {
                // If espeak fails, try festival
                const festProc = spawn('festival', ['--tts']);
                festProc.stdin.write(text);
                festProc.stdin.end();
                
                festProc.on('error', (error) => {
                    resolve({
                        success: false,
                        error: `Linux TTS failed: ${error.message}`
                    });
                });
                
                festProc.on('close', (code) => {
                    if (code === 0) {
                        resolve({
                            success: true,
                            outputFile: options.outputFile
                        });
                    } else {
                        resolve({
                            success: false,
                            error: `Linux TTS exited with code ${code}`
                        });
                    }
                });
            });
            
            proc.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        outputFile: options.outputFile
                    });
                } else {
                    resolve({
                        success: false,
                        error: `espeak exited with code ${code}`
                    });
                }
            });
        });
    }
    
    private async playAudio(filePath: string): Promise<void> {
        const platform = process.platform;
        
        return new Promise((resolve, reject) => {
            let command: string;
            let args: string[] = [filePath];
            
            if (platform === 'darwin') {
                command = 'afplay';
            } else if (platform === 'win32') {
                command = 'powershell';
                args = ['-c', `(New-Object Media.SoundPlayer "${filePath}").PlaySync()`];
            } else {
                // Linux - try multiple players
                command = 'aplay';
            }
            
            const proc = spawn(command, args);
            
            proc.on('error', (error) => {
                // Try alternative players on Linux
                if (platform === 'linux') {
                    const mpvProc = spawn('mpv', ['--no-video', filePath]);
                    mpvProc.on('error', () => {
                        const ffplayProc = spawn('ffplay', ['-nodisp', '-autoexit', filePath]);
                        ffplayProc.on('error', () => reject(error));
                        ffplayProc.on('close', () => resolve());
                    });
                    mpvProc.on('close', () => resolve());
                } else {
                    reject(error);
                }
            });
            
            proc.on('close', () => resolve());
        });
    }
    
    /**
     * Get optimal voice configuration based on language and preferences
     */
    private getOptimalVoiceConfig(options: VoiceOptions): {
        voiceId: string;
        model: string;
        voiceSettings: any;
    } {
        const language = options.language || 'en';
        const requestedVoice = options.voice;
        
        // Get language-specific voices
        const langVoices = LANGUAGE_VOICES[language as keyof typeof LANGUAGE_VOICES] || LANGUAGE_VOICES.en;
        
        let voiceId: string;
        
        if (requestedVoice) {
            // User specified a voice - check if it exists for this language
            if (requestedVoice in langVoices) {
                voiceId = langVoices[requestedVoice as keyof typeof langVoices];
            } else if (requestedVoice in DEFAULT_VOICES) {
                voiceId = DEFAULT_VOICES[requestedVoice as keyof typeof DEFAULT_VOICES];
            } else {
                // Assume it's a custom voice ID
                voiceId = requestedVoice;
            }
        } else {
            // Auto-select best voice for language
            voiceId = langVoices.default || langVoices[Object.keys(langVoices)[0] as keyof typeof langVoices];
        }
        
        // Get optimal model for language
        const model = options.model || LANGUAGE_MODELS[language as keyof typeof LANGUAGE_MODELS] || LANGUAGE_MODELS.default;
        
        // Language-specific voice settings
        const voiceSettings = this.getLanguageOptimizedSettings(language, options);
        
        return { voiceId, model, voiceSettings };
    }
    
    /**
     * Get voice settings optimized for specific languages
     */
    private getLanguageOptimizedSettings(language: string, options: VoiceOptions) {
        const baseSettings = {
            stability: options.stability ?? 0.5,
            similarity_boost: options.similarityBoost ?? 0.75, // Higher for better pronunciation
            style: options.style ?? 0,
            use_speaker_boost: options.speakerBoost ?? true
        };
        
        // Language-specific optimizations
        switch (language) {
            case 'fr': // French
                return {
                    ...baseSettings,
                    stability: options.stability ?? 0.6,        // More stable for French pronunciation
                    similarity_boost: options.similarityBoost ?? 0.8,  // Higher for accent accuracy
                    style: options.style ?? 0.1,               // Slight style for French flair
                };
                
            case 'es': // Spanish
                return {
                    ...baseSettings,
                    stability: options.stability ?? 0.55,       // Balanced for Spanish rhythm
                    similarity_boost: options.similarityBoost ?? 0.85, // High for rolled R's, etc.
                    style: options.style ?? 0.15,              // Slight expressiveness
                };
                
            case 'ht': // Haitian Creole
                return {
                    ...baseSettings,
                    stability: options.stability ?? 0.7,        // More stable for clarity
                    similarity_boost: options.similarityBoost ?? 0.6,  // Lower, using English voice
                    style: options.style ?? 0,                 // Neutral style
                };
                
            default: // English and others
                return baseSettings;
        }
    }
    
    /**
     * Get voice ID (legacy method for compatibility)
     */
    private getVoiceId(voice?: string): string {
        if (!voice) {
            return DEFAULT_VOICES.alloy; // Default voice
        }
        
        // Check if it's a predefined voice name
        if (voice in DEFAULT_VOICES) {
            return DEFAULT_VOICES[voice as keyof typeof DEFAULT_VOICES];
        }
        
        // Assume it's a custom voice ID
        return voice;
    }
    
    private getVoiceDescription(voiceName: string): string {
        const descriptions: { [key: string]: string } = {
            'alloy': 'Warm, Friendly (Rachel)',
            'echo': 'Professional, Clear (Clyde)',
            'nova': 'Energetic, Enthusiastic (Charlie)',
            'shimmer': 'Clear, Articulate (Charlotte)',
            'onyx': 'Deep, Authoritative (Callum)',
            'fable': 'Expressive, Dynamic (Gigi)',
            'antoine': 'French Male, Natural',
            'charlotte': 'French Female, Clear',
            'henri': 'French Male, Professional',
            'marie': 'French Female, Warm',
            'antonio': 'Spanish Male, Neutral',
            'isabella': 'Spanish Female, Clear',
            'pablo': 'Spanish Male, Energetic',
            'sofia': 'Spanish Female, Professional'
        };
        
        return descriptions[voiceName] || 'Available Voice';
    }
    
    cleanTextForSpeech(text: string): string {
        // Remove markdown formatting
        let cleaned = text
            .replace(/#{1,6}\s/g, '') // Remove headers
            .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
            .replace(/\*([^*]+)\*/g, '$1') // Remove italic
            .replace(/`([^`]+)`/g, '$1') // Remove code blocks
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
            .replace(/^[-*+]\s/gm, '') // Remove list markers
            .replace(/^\d+\.\s/gm, ''); // Remove numbered lists
        
        // Remove excessive whitespace
        cleaned = cleaned
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        
        // Limit length for TTS (some services have limits)
        const maxLength = 5000;
        if (cleaned.length > maxLength) {
            cleaned = cleaned.substring(0, maxLength) + '...';
        }
        
        return cleaned;
    }
    
    async listVoices(language?: string): Promise<string[]> {
        const platform = process.platform;
        
        if (this.client && this.apiKey) {
            try {
                const voices = await this.client.voices.getAll();
                const result: string[] = [];
                
                result.push('🎤 Available Voices (use name or voice ID):');
                result.push('');
                
                // English voices
                result.push('🇺🇸 ENGLISH VOICES:');
                Object.entries(LANGUAGE_VOICES.en).forEach(([name, id]) => {
                    if (name !== 'default') {
                        const voice = voices.voices.find(v => v.voice_id === id);
                        if (voice) {
                            result.push(`  • ${name} → ${this.getVoiceDescription(name)}`);
                        }
                    }
                });
                
                result.push('');
                
                // French voices
                if (LANGUAGE_VOICES.fr) {
                    const frenchVoices: string[] = [];
                    Object.entries(LANGUAGE_VOICES.fr).forEach(([name, id]) => {
                        if (name !== 'default') {
                            const voice = voices.voices.find(v => v.voice_id === id);
                            if (voice) {
                                frenchVoices.push(`  • ${name} → ${this.getVoiceDescription(name)}`);
                            }
                        }
                    });
                    if (frenchVoices.length > 0) {
                        result.push('🇫🇷 FRENCH VOICES:');
                        result.push(...frenchVoices);
                        result.push('');
                    }
                }
                
                // Spanish voices
                if (LANGUAGE_VOICES.es) {
                    const spanishVoices: string[] = [];
                    Object.entries(LANGUAGE_VOICES.es).forEach(([name, id]) => {
                        if (name !== 'default') {
                            const voice = voices.voices.find(v => v.voice_id === id);
                            if (voice) {
                                spanishVoices.push(`  • ${name} → ${this.getVoiceDescription(name)}`);
                            }
                        }
                    });
                    if (spanishVoices.length > 0) {
                        result.push('🇪🇸 SPANISH VOICES:');
                        result.push(...spanishVoices);
                        result.push('');
                    }
                }
                
                // Haitian Creole note
                if (LANGUAGE_VOICES.ht) {
                    result.push('🇭🇹 HAITIAN CREOLE:');
                    result.push('  • Uses English voice with optimized settings');
                    result.push('');
                }
                
                result.push('💡 USAGE EXAMPLES:');
                result.push('  glance https://example.com --voice nova --read');
                result.push('  glance https://example.com --voice antoine -l fr --read');
                result.push('  glance https://example.com --voice isabella -l es --read');
                result.push('');
                result.push('⚠️  NOTE: Only the voices listed above work with simple names.');
                result.push('   For other voices, use the full voice ID (long string).');
                result.push('');
                result.push('🔍 ALL AVAILABLE VOICES IN YOUR ACCOUNT:');
                voices.voices.forEach(v => {
                    result.push(`   ${v.name} (${v.voice_id})`);
                });
                
                return result;
                
            } catch (error) {
                console.warn('Failed to fetch ElevenLabs voices:', error);
            }
        }
        
        // Return local system voices
        if (platform === 'darwin') {
            return new Promise((resolve) => {
                const proc = spawn('say', ['-v', '?']);
                let output = '';
                
                proc.stdout.on('data', (data) => {
                    output += data.toString();
                });
                
                proc.on('close', () => {
                    const voices = output
                        .split('\n')
                        .filter(line => line.trim())
                        .map(line => {
                            const parts = line.split(/\s+/);
                            const name = parts[0];
                            const lang = parts.slice(1).join(' ');
                            return `${name} - ${lang} [LOCAL]`;
                        });
                    resolve(voices);
                });
                
                proc.on('error', () => {
                    resolve([]);
                });
            });
        }
        
        return [];
    }
}

export function createVoiceSynthesizer(apiKey?: string): VoiceSynthesizer {
    return new VoiceSynthesizer(apiKey);
}

export function cleanTextForSpeech(text: string): string {
    // Remove markdown formatting
    let cleaned = text
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
        .replace(/`([^`]+)`/g, '$1') // Remove code blocks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
        .replace(/^[-*+]\s/gm, '') // Remove list markers
        .replace(/^\d+\.\s/gm, ''); // Remove numbered lists
    
    // Remove excessive whitespace
    cleaned = cleaned
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    
    // Limit length for TTS (some services have limits)
    const maxLength = 5000;
    if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength) + '...';
    }
    
    return cleaned;
}