/* systems/tts — הקראה בעברית מנוקדת, קול טבעי (גיבוי בלבד) */
export function speak(text:string){try{
 if(!('speechSynthesis' in window))return;
 const u=new SpeechSynthesisUtterance(text);
 u.lang='he-IL';u.rate=1;u.pitch=1;
 const he=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith('he'));
 if(he)u.voice=he;
 window.speechSynthesis.speak(u);
}catch{/* noop */}}
