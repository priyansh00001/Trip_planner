/**
 * Local Phrases Database — 22 Indian Languages
 * 
 * Maps Indian states/cities to their primary language
 * and provides essential travel survival phrases.
 */

export interface Phrase {
  english: string
  local: string
  pronunciation: string
}

export interface LanguageData {
  language: string
  phrases: Phrase[]
}

// City/State → Language mapping
export const CITY_LANGUAGE_MAP: Record<string, string> = {
  // Hindi-speaking
  delhi: 'hindi', 'new delhi': 'hindi', agra: 'hindi', varanasi: 'hindi',
  lucknow: 'hindi', jaipur: 'hindi', jodhpur: 'hindi', udaipur: 'hindi',
  jaisalmer: 'hindi', pushkar: 'hindi', rishikesh: 'hindi', haridwar: 'hindi',
  manali: 'hindi', shimla: 'hindi', mussoorie: 'hindi', nainital: 'hindi',
  dehradun: 'hindi', bhopal: 'hindi', indore: 'hindi', leh: 'hindi',
  jibhi: 'hindi', chandigarh: 'hindi', amritsar: 'punjabi',

  // South India
  bangalore: 'kannada', bengaluru: 'kannada', mysore: 'kannada', hampi: 'kannada',
  coorg: 'kannada', mangalore: 'kannada',
  chennai: 'tamil', madurai: 'tamil', ooty: 'tamil', pondicherry: 'tamil',
  kanchipuram: 'tamil', rameswaram: 'tamil', kodaikanal: 'tamil',
  kochi: 'malayalam', munnar: 'malayalam', alleppey: 'malayalam',
  thiruvananthapuram: 'malayalam', kozhikode: 'malayalam', wayanad: 'malayalam',
  hyderabad: 'telugu', vizag: 'telugu', visakhapatnam: 'telugu',
  tirupati: 'telugu', vijayawada: 'telugu',

  // West India
  mumbai: 'marathi', pune: 'marathi', nagpur: 'marathi', nashik: 'marathi',
  aurangabad: 'marathi', lonavala: 'marathi',
  goa: 'konkani', panaji: 'konkani', margao: 'konkani',
  ahmedabad: 'gujarati', surat: 'gujarati', vadodara: 'gujarati',
  dwarka: 'gujarati', kutch: 'gujarati',

  // East India
  kolkata: 'bengali', darjeeling: 'bengali', siliguri: 'bengali',
  digha: 'bengali', sundarbans: 'bengali', shantiniketan: 'bengali',
  bhubaneswar: 'odia', puri: 'odia', konark: 'odia',
  guwahati: 'assamese', kaziranga: 'assamese', shillong: 'khasi',

  // Kashmir
  srinagar: 'kashmiri',
}

// Phrase database per language
export const PHRASES_DB: Record<string, LanguageData> = {

  hindi: {
    language: "Hindi",
    phrases: [
      { english: "Hello / Greetings", local: "नमस्ते", pronunciation: "Namaste" },
      { english: "Thank you", local: "धन्यवाद", pronunciation: "Dhanyavaad" },
      { english: "How much is this?", local: "यह कितने का है?", pronunciation: "Yeh kitne ka hai?" },
      { english: "Where is...?", local: "...कहाँ है?", pronunciation: "...kahaan hai?" },
      { english: "Help!", local: "मदद करो!", pronunciation: "Madad karo!" },
      { english: "I don't understand", local: "मुझे समझ नहीं आया", pronunciation: "Mujhe samajh nahi aaya" },
      { english: "Water please", local: "पानी दीजिए", pronunciation: "Paani dijiye" },
      { english: "Yes / No", local: "हाँ / नहीं", pronunciation: "Haan / Nahi" },
      { english: "Please call a doctor", local: "डॉक्टर को बुलाइए", pronunciation: "Doctor ko bulaiye" },
      { english: "The food is delicious", local: "खाना बहुत स्वादिष्ट है", pronunciation: "Khaana bahut swaadisht hai" },
    ]
  },

  tamil: {
    language: "Tamil",
    phrases: [
      { english: "Hello / Greetings", local: "வணக்கம்", pronunciation: "Vanakkam" },
      { english: "Thank you", local: "நன்றி", pronunciation: "Nandri" },
      { english: "How much is this?", local: "இது எவ்வளவு?", pronunciation: "Idhu evvalavu?" },
      { english: "Where is...?", local: "...எங்கே?", pronunciation: "...engey?" },
      { english: "Help!", local: "உதவி!", pronunciation: "Udhavi!" },
      { english: "I don't understand", local: "எனக்கு புரியவில்லை", pronunciation: "Enakku puriyavillai" },
      { english: "Water please", local: "தண்ணீர் கொடுங்கள்", pronunciation: "Thanneer kodungal" },
      { english: "Yes / No", local: "ஆம் / இல்லை", pronunciation: "Aam / Illai" },
      { english: "Please call a doctor", local: "டாக்டரை கூப்பிடுங்கள்", pronunciation: "Doctarai koopidungal" },
      { english: "The food is delicious", local: "சாப்பாடு மிகவும் நல்லது", pronunciation: "Saappaadu migavum nalladhu" },
    ]
  },

  kannada: {
    language: "Kannada",
    phrases: [
      { english: "Hello / Greetings", local: "ನಮಸ್ಕಾರ", pronunciation: "Namaskara" },
      { english: "Thank you", local: "ಧನ್ಯವಾದ", pronunciation: "Dhanyavaada" },
      { english: "How much is this?", local: "ಇದು ಎಷ್ಟು?", pronunciation: "Idu eshtu?" },
      { english: "Where is...?", local: "...ಎಲ್ಲಿ?", pronunciation: "...elli?" },
      { english: "Help!", local: "ಸಹಾಯ ಮಾಡಿ!", pronunciation: "Sahaaya maadi!" },
      { english: "I don't understand", local: "ನನಗೆ ಅರ್ಥ ಆಗಲಿಲ್ಲ", pronunciation: "Nanage artha aagalilla" },
      { english: "Water please", local: "ನೀರು ಕೊಡಿ", pronunciation: "Neeru kodi" },
      { english: "Yes / No", local: "ಹೌದು / ಇಲ್ಲ", pronunciation: "Haudu / Illa" },
      { english: "Please call a doctor", local: "ದಯವಿಟ್ಟು ವೈದ್ಯರನ್ನು ಕರೆಯಿರಿ", pronunciation: "Dayavittu vaidyarannu kareyiri" },
      { english: "The food is delicious", local: "ಊಟ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ", pronunciation: "Oota tumba chennaagide" },
    ]
  },

  malayalam: {
    language: "Malayalam",
    phrases: [
      { english: "Hello / Greetings", local: "നമസ്കാരം", pronunciation: "Namaskaaram" },
      { english: "Thank you", local: "നന്ദി", pronunciation: "Nandi" },
      { english: "How much is this?", local: "ഇതിന്റെ വില എത്ര?", pronunciation: "Ithinte vila ethra?" },
      { english: "Where is...?", local: "...എവിടെ?", pronunciation: "...evide?" },
      { english: "Help!", local: "സഹായിക്കൂ!", pronunciation: "Sahaayikkoo!" },
      { english: "I don't understand", local: "എനിക്ക് മനസ്സിലായില്ല", pronunciation: "Enikku manasilayilla" },
      { english: "Water please", local: "വെള്ളം തരൂ", pronunciation: "Vellam tharoo" },
      { english: "Yes / No", local: "ഉവ്വ് / ഇല്ല", pronunciation: "Uvvu / Illa" },
      { english: "Please call a doctor", local: "ദയവായി ഡോക്ടറെ വിളിക്കൂ", pronunciation: "Dayavaayi doctore vilikkoo" },
      { english: "The food is delicious", local: "ഭക്ഷണം വളരെ നല്ലതാണ്", pronunciation: "Bhakshanam valare nallathaanu" },
    ]
  },

  telugu: {
    language: "Telugu",
    phrases: [
      { english: "Hello / Greetings", local: "నమస్కారం", pronunciation: "Namaskaaram" },
      { english: "Thank you", local: "ధన్యవాదాలు", pronunciation: "Dhanyavaadaalu" },
      { english: "How much is this?", local: "ఇది ఎంత?", pronunciation: "Idi entha?" },
      { english: "Where is...?", local: "...ఎక్కడ?", pronunciation: "...ekkada?" },
      { english: "Help!", local: "సహాయం!", pronunciation: "Sahaayam!" },
      { english: "I don't understand", local: "నాకు అర్థం కాలేదు", pronunciation: "Naaku artham kaaledu" },
      { english: "Water please", local: "నీళ్ళు ఇవ్వండి", pronunciation: "Neellu ivvandi" },
      { english: "Yes / No", local: "అవును / కాదు", pronunciation: "Avunu / Kaadu" },
      { english: "Please call a doctor", local: "దయచేసి డాక్టర్ని పిలవండి", pronunciation: "Dayachesi doctorni pilavandi" },
      { english: "The food is delicious", local: "భోజనం చాలా బాగుంది", pronunciation: "Bhojanam chaala baagundi" },
    ]
  },

  bengali: {
    language: "Bengali",
    phrases: [
      { english: "Hello / Greetings", local: "নমস্কার", pronunciation: "Nomoshkar" },
      { english: "Thank you", local: "ধন্যবাদ", pronunciation: "Dhonnobad" },
      { english: "How much is this?", local: "এটা কত?", pronunciation: "Eta koto?" },
      { english: "Where is...?", local: "...কোথায়?", pronunciation: "...kothay?" },
      { english: "Help!", local: "সাহায্য করুন!", pronunciation: "Shahajjo korun!" },
      { english: "I don't understand", local: "আমি বুঝতে পারছি না", pronunciation: "Ami bujhte parchhi na" },
      { english: "Water please", local: "জল দিন", pronunciation: "Jol din" },
      { english: "Yes / No", local: "হ্যাঁ / না", pronunciation: "Hyaan / Na" },
      { english: "Please call a doctor", local: "ডাক্তার ডাকুন", pronunciation: "Daktar dakun" },
      { english: "The food is delicious", local: "খাবার খুব ভালো", pronunciation: "Khabar khub bhaalo" },
    ]
  },

  marathi: {
    language: "Marathi",
    phrases: [
      { english: "Hello / Greetings", local: "नमस्कार", pronunciation: "Namaskar" },
      { english: "Thank you", local: "धन्यवाद", pronunciation: "Dhanyavaad" },
      { english: "How much is this?", local: "हे किती?", pronunciation: "He kiti?" },
      { english: "Where is...?", local: "...कुठे आहे?", pronunciation: "...kuthe aahe?" },
      { english: "Help!", local: "मदत करा!", pronunciation: "Madat kara!" },
      { english: "I don't understand", local: "मला समजलं नाही", pronunciation: "Mala samajla nahi" },
      { english: "Water please", local: "पाणी द्या", pronunciation: "Paani dya" },
      { english: "Yes / No", local: "हो / नाही", pronunciation: "Ho / Nahi" },
      { english: "Please call a doctor", local: "डॉक्टरांना बोलवा", pronunciation: "Doctoranna bolva" },
      { english: "The food is delicious", local: "जेवण खूप छान आहे", pronunciation: "Jevan khoop chhaan aahe" },
    ]
  },

  gujarati: {
    language: "Gujarati",
    phrases: [
      { english: "Hello / Greetings", local: "નમસ્તે", pronunciation: "Namaste" },
      { english: "Thank you", local: "આભાર", pronunciation: "Aabhaar" },
      { english: "How much is this?", local: "આ કેટલાનું છે?", pronunciation: "Aa ketlaanu chhe?" },
      { english: "Where is...?", local: "...ક્યાં છે?", pronunciation: "...kyaan chhe?" },
      { english: "Help!", local: "મદદ કરો!", pronunciation: "Madad karo!" },
      { english: "I don't understand", local: "મને સમજાતું નથી", pronunciation: "Mane samjaatu nathi" },
      { english: "Water please", local: "પાણી આપો", pronunciation: "Paani aapo" },
      { english: "Yes / No", local: "હા / ના", pronunciation: "Haa / Naa" },
      { english: "Please call a doctor", local: "ડૉક્ટરને બોલાવો", pronunciation: "Doctorne bolaavo" },
      { english: "The food is delicious", local: "જમવાનું ખૂબ સરસ છે", pronunciation: "Jamvaanu khub saras chhe" },
    ]
  },

  punjabi: {
    language: "Punjabi",
    phrases: [
      { english: "Hello / Greetings", local: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", pronunciation: "Sat Sri Akaal" },
      { english: "Thank you", local: "ਧੰਨਵਾਦ", pronunciation: "Dhannvaad" },
      { english: "How much is this?", local: "ਇਹ ਕਿੰਨੇ ਦਾ ਹੈ?", pronunciation: "Eh kinne da hai?" },
      { english: "Where is...?", local: "...ਕਿੱਥੇ ਹੈ?", pronunciation: "...kithe hai?" },
      { english: "Help!", local: "ਮਦਦ ਕਰੋ!", pronunciation: "Madad karo!" },
      { english: "I don't understand", local: "ਮੈਨੂੰ ਸਮਝ ਨਹੀਂ ਆਈ", pronunciation: "Mainoo samajh nahi aai" },
      { english: "Water please", local: "ਪਾਣੀ ਦਿਓ", pronunciation: "Paani deo" },
      { english: "Yes / No", local: "ਹਾਂ / ਨਹੀਂ", pronunciation: "Haan / Nahi" },
      { english: "Please call a doctor", local: "ਡਾਕਟਰ ਨੂੰ ਬੁਲਾਓ", pronunciation: "Doctor noon bulaao" },
      { english: "The food is delicious", local: "ਖਾਣਾ ਬਹੁਤ ਸੁਆਦੀ ਹੈ", pronunciation: "Khaana bahut suaadi hai" },
    ]
  },

  odia: {
    language: "Odia",
    phrases: [
      { english: "Hello / Greetings", local: "ନମସ୍କାର", pronunciation: "Namaskar" },
      { english: "Thank you", local: "ଧନ୍ୟବାଦ", pronunciation: "Dhanyabaad" },
      { english: "How much is this?", local: "ଏହାର ଦାମ କେତେ?", pronunciation: "Ehaara daam kete?" },
      { english: "Where is...?", local: "...କେଉଁଠି?", pronunciation: "...keunthi?" },
      { english: "Help!", local: "ସାହାଯ୍ୟ କରନ୍ତୁ!", pronunciation: "Sahaajya karantu!" },
      { english: "I don't understand", local: "ମୋତେ ବୁଝି ହେଉନାହିଁ", pronunciation: "Mote bujhi heunaahin" },
      { english: "Water please", local: "ପାଣି ଦିଅନ୍ତୁ", pronunciation: "Paani diantu" },
      { english: "Yes / No", local: "ହଁ / ନାହିଁ", pronunciation: "Han / Naahin" },
      { english: "Please call a doctor", local: "ଡାକ୍ତରଙ୍କୁ ଡାକନ୍ତୁ", pronunciation: "Daktaranku daakantu" },
      { english: "The food is delicious", local: "ଖାଦ୍ୟ ବହୁତ ସୁଆଦିଆ", pronunciation: "Khaadya bahut suaadia" },
    ]
  },

  assamese: {
    language: "Assamese",
    phrases: [
      { english: "Hello / Greetings", local: "নমস্কাৰ", pronunciation: "Nomoskar" },
      { english: "Thank you", local: "ধন্যবাদ", pronunciation: "Dhonnobad" },
      { english: "How much is this?", local: "ইয়াৰ দাম কিমান?", pronunciation: "Iyar daam kimaan?" },
      { english: "Where is...?", local: "...ক'ত?", pronunciation: "...kot?" },
      { english: "Help!", local: "সহায় কৰক!", pronunciation: "Sohai korok!" },
      { english: "I don't understand", local: "মই বুজি পোৱা নাই", pronunciation: "Moi buji powa naai" },
      { english: "Water please", local: "পানী দিয়ক", pronunciation: "Paani diyok" },
      { english: "Yes / No", local: "হয় / নহয়", pronunciation: "Hoi / Nohoi" },
      { english: "Please call a doctor", local: "চিকিৎসক মাতক", pronunciation: "Chikitsok maatok" },
      { english: "The food is delicious", local: "খাদ্য বৰ সোৱাদ", pronunciation: "Khaadyo bor sowaad" },
    ]
  },

  konkani: {
    language: "Konkani",
    phrases: [
      { english: "Hello / Greetings", local: "नमस्कार", pronunciation: "Namaskar" },
      { english: "Thank you", local: "देव बरें करूं", pronunciation: "Dev bare karoon" },
      { english: "How much is this?", local: "हें कितलें?", pronunciation: "Hen kithlen?" },
      { english: "Where is...?", local: "...खंय आसा?", pronunciation: "...khanyi aasa?" },
      { english: "Help!", local: "कुमक करात!", pronunciation: "Kumok karaat!" },
      { english: "I don't understand", local: "म्हाका समजलें ना", pronunciation: "Mhaka samjolen na" },
      { english: "Water please", local: "उदक दिया", pronunciation: "Udak diya" },
      { english: "Yes / No", local: "व्हय / ना", pronunciation: "Vhoi / Na" },
      { english: "Please call a doctor", local: "दोतोराक आपयात", pronunciation: "Dotoraak aapyaat" },
      { english: "The food is delicious", local: "जेवण खूब रुचिक आसा", pronunciation: "Jevan khub ruchik aasa" },
    ]
  },

  kashmiri: {
    language: "Kashmiri",
    phrases: [
      { english: "Hello / Greetings", local: "آداب / السلام علیکم", pronunciation: "Aadaab / Assalamu Alaikum" },
      { english: "Thank you", local: "شُکریہ", pronunciation: "Shukriya" },
      { english: "How much is this?", local: "یہ کتنے کا ہے؟", pronunciation: "Yi kati chu?" },
      { english: "Where is...?", local: "...کتہ چھ؟", pronunciation: "...kati chhu?" },
      { english: "Help!", local: "مدد!", pronunciation: "Madad!" },
      { english: "I don't understand", local: "مے نہ چھ سمجھان", pronunciation: "Me na chu samjhaan" },
      { english: "Water please", local: "اوب دیتو", pronunciation: "Oub dyutuv" },
      { english: "Yes / No", local: "آ / نہ", pronunciation: "Aa / Na" },
      { english: "Please call a doctor", local: "ڈاکٹر سند بولاو", pronunciation: "Doctor sund bulaav" },
      { english: "The food is delicious", local: "خانا بوہ مزیدار چھ", pronunciation: "Khaana bohuth mazedaar chu" },
    ]
  },

  khasi: {
    language: "Khasi",
    phrases: [
      { english: "Hello / Greetings", local: "Kumno", pronunciation: "Koom-no" },
      { english: "Thank you", local: "Khublei", pronunciation: "Khu-blay" },
      { english: "How much is this?", local: "Katno ka man?", pronunciation: "Kat-no ka man?" },
      { english: "Where is...?", local: "...hangno?", pronunciation: "...hang-no?" },
      { english: "Help!", local: "Ïa ngan kwah burom!", pronunciation: "Ia ngan kwah boo-rom!" },
      { english: "I don't understand", local: "Nga em tip", pronunciation: "Nga em teep" },
      { english: "Water please", local: "Um ha", pronunciation: "Um ha" },
      { english: "Yes / No", local: "Hooid / Em", pronunciation: "Hooid / Em" },
      { english: "Please call a doctor", local: "Khot ia ka doctor", pronunciation: "Khot ia ka doctor" },
      { english: "The food is delicious", local: "Ka jingbuh ka bha", pronunciation: "Ka jing-buh ka bha" },
    ]
  },
}
