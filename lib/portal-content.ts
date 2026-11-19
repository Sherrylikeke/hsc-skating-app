import snapshot from '../data/portal-snapshot.json';

export type PortalPage={path:string;title:string;body:string;source:string;images:{src:string;alt:string}[];links:{label:string;href:string}[];videos:string[];revision?:number};
export const portalSnapshot=snapshot;
export type PortalCoach=(typeof snapshot.coaches)[number];
export const portalCoachKey=(name:string)=>'coach:'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
export const portalNavigation=[['/','Home'],['/about-us/','About Us'],['/our-programs/','Our Programs'],['/our-coaches/','Our Coaches'],['/club-resources/','Club Resources'],['/registration/','Registration'],['/schedule/','Schedule'],['/news/','News'],['/contact-us/','Contact Us']] as const;
export function canonicalPortalPath(value:string){return value==='/'?'/':value.endsWith('.php')?value:'/'+value.split('/').filter(Boolean).join('/')+'/';}
export const portalPages:PortalPage[]=[...snapshot.pages,{path:'/ajax/cookies.php',title:'Cookies & privacy',body:'This portal uses essential cookies to keep you signed in and protect your account. Your display preferences may be stored on this device. We do not copy Uplifter cookies or your old login session. Payment-provider cookie information will be added before online payment is enabled.',source:'',images:[],links:[{label:'Privacy policy',href:'/club-resources/privacy-policy/'}],videos:[]}];
export function portalPage(path:string){return portalPages.find(p=>p.path===canonicalPortalPath(path));}
export const portalEditablePages=[...portalPages,...snapshot.coaches.map(c=>({path:portalCoachKey(c.name),title:c.name,body:c.body,source:c.sourceUrl,images:[{src:c.imageLocalPath,alt:c.name}],links:[],videos:[]}))];
export function portalHref(href:string){
 if(href.startsWith('/portal-assets/')||href.startsWith('/api/'))return href;
 if(href.startsWith('/login'))return '/member?portalReturn='+encodeURIComponent('/portal/registration/');
 if(href.startsWith('/forgot-password.php')||href.startsWith('/reset-password.php'))return '/reset-password';
 if(href.startsWith('/')&&!href.startsWith('//'))return '/portal'+(href==='/'?'':href);
 return /^(https?:|mailto:|tel:|#)/i.test(href)?href:'#';
}
export const portalProgrammes=[
 {name:'Learn to Skate',label:'A confident first step',description:'Build balance, confidence and a love of skating. Pre-CanSkate, CanSkate and Teen / Adult programmes.',image:'/portal-assets/gabriella-peace-img-1216-68a17837d282.jpg'},
 {name:'Junior Academy',label:'Discover what comes next',description:'Take the next step from basic skating skills into figure skating.',image:'/portal-assets/ja-picture-cc6863f159bd.png'},
 {name:'STAR 1–10',label:'Grow at your own pace',description:'Develop skills in figure skating, supported by our professional coaching team.',image:'/portal-assets/adina-munro-img-0390-68bf655a85a6.jpg'},
 {name:'Competitive',label:'Find your next challenge',description:'Training and development for skaters pursuing competitive figure skating.',image:'/portal-assets/sofia-nazarova-dre-0009-ab4b6e7de223.jpg'},
];
export type PortalItem={id:string;kind:string;name:string;description:string;priceCents:number;soldOut:boolean;reviewRequired:boolean;category:string;source:string;start?:string;end?:string;location?:string;events?:{date:string;time:string}[]};
export const portalCatalogue:PortalItem[]=[
 {id:'snapshot-synchro',kind:'course',name:'26/27 SCS STAR 3 Synchro',description:'Steel City Synchro. The published title and programme description differ. Please contact the club to confirm the applicable team, commitment fee and registration details.',priceCents:105000,soldOut:false,reviewRequired:true,category:'Steel City Synchro',source:snapshot.source+'/registration/',start:'2026-09-08',end:'2027-03-17',location:'Dave Andreychuk Mountain Arena & Skating Centre',events:[]},
 ...snapshot.products,
 {id:'snapshot-membership',kind:'membership',name:'2026/2027 Skate Canada',description:'Annual membership applies to the skater. September 1, 2026 to September 1, 2027. Existing membership and amounts already paid must be checked before charging.',priceCents:6570,soldOut:false,reviewRequired:true,category:'Annual membership',source:snapshot.source+'/registration/subscriptions/'},
];
