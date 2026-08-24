/* i18n — עברית (מנוקדת) ברירת מחדל + אנגלית; הרחבה קלה לשפות נוספות */
const STRINGS:Record<string,Record<string,string>>={
 he:{cta:'יוֹצְאִים לַמַּסָּע',hub:'בַּחֲרִי עוֹלָם',parents:'פִּנַּת הַהוֹרִים',tagline:'גַּן שֶׁל אוֹרוֹת',who:'מִי הַכֶּלֶב?'},
 en:{cta:'Start the journey',hub:'Choose a world',parents:'Parents corner',tagline:'Garden of Lights',who:'Who is the dog?'}};
export type Lang='he'|'en';
export function getLang():Lang{try{const l=localStorage.getItem('lenny-lang');if(l==='en')return 'en';}catch{/* */}return 'he';}
export function setLang(l:Lang){try{localStorage.setItem('lenny-lang',l);}catch{/* */}}
export function t(k:string){const L=getLang();return (STRINGS[L]&&STRINGS[L][k])||STRINGS.he[k]||k;}
(window as any).__setLang=(l:Lang)=>setLang(l);
(window as any).__getLang=()=>getLang();
