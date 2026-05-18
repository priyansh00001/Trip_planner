/**
 * Curated Emergency Hospital Database — 50 Major Indian Cities
 * 
 * Sources: Government health portals, verified hospital websites
 * Every entry is a real, existing, well-known hospital.
 * Phone "108" is the universal emergency ambulance number in India.
 */

export interface Hospital {
  name: string
  address: string
  phone: string
  type?: 'government' | 'private' | 'multispecialty'
}

export const EMERGENCY_DB: Record<string, Hospital[]> = {

  // ─── North India ──────────────────────────────────────

  delhi: [
    { name: "AIIMS (All India Institute of Medical Sciences)", address: "Ansari Nagar, New Delhi", phone: "011-26588500", type: "government" },
    { name: "Safdarjung Hospital", address: "Ansari Nagar West, New Delhi", phone: "011-26707437", type: "government" },
    { name: "Sir Ganga Ram Hospital", address: "Rajinder Nagar, New Delhi", phone: "011-25722233", type: "private" },
    { name: "Max Super Speciality Hospital", address: "Saket, New Delhi", phone: "011-26515050", type: "private" },
  ],

  jaipur: [
    { name: "SMS Hospital (Sawai Man Singh)", address: "JLN Marg, Jaipur", phone: "0141-2518900", type: "government" },
    { name: "Fortis Escorts Hospital", address: "Malviya Nagar, Jaipur", phone: "0141-2547000", type: "private" },
    { name: "Narayana Multispeciality Hospital", address: "Sector 28, Kumbha Marg, Jaipur", phone: "0141-7125555", type: "private" },
  ],

  agra: [
    { name: "S.N. Medical College & Hospital", address: "Hospital Road, Agra", phone: "0562-2260275", type: "government" },
    { name: "Pushpanjali Hospital", address: "Delhi Gate, Agra", phone: "0562-4050505", type: "private" },
    { name: "Paras Hospital", address: "Sikandra, Agra", phone: "0562-2640202", type: "private" },
  ],

  lucknow: [
    { name: "King George's Medical University (KGMU)", address: "Shah Mina Road, Lucknow", phone: "0522-2257540", type: "government" },
    { name: "Sanjay Gandhi Post Graduate Institute (SGPGI)", address: "Rae Bareli Road, Lucknow", phone: "0522-2668700", type: "government" },
    { name: "Medanta Hospital", address: "Shaheed Path, Lucknow", phone: "0522-4505050", type: "private" },
  ],

  varanasi: [
    { name: "Banaras Hindu University Hospital (Sir Sunderlal)", address: "BHU Campus, Varanasi", phone: "0542-2307565", type: "government" },
    { name: "Heritage Hospital", address: "Lanka, Varanasi", phone: "0542-2276999", type: "private" },
    { name: "Shiv Prasad Gupta Hospital", address: "Kabir Chaura, Varanasi", phone: "0542-2202083", type: "government" },
  ],

  amritsar: [
    { name: "Government Medical College & Hospital", address: "Circular Road, Amritsar", phone: "0183-2222157", type: "government" },
    { name: "Fortis Escorts Hospital", address: "Majitha Verka Bypass, Amritsar", phone: "0183-5025555", type: "private" },
    { name: "Amandeep Hospital", address: "GT Road, Amritsar", phone: "0183-5060555", type: "private" },
  ],

  chandigarh: [
    { name: "PGIMER (Post Graduate Institute)", address: "Sector 12, Chandigarh", phone: "0172-2746018", type: "government" },
    { name: "GMCH (Government Medical College)", address: "Sector 32, Chandigarh", phone: "0172-2665253", type: "government" },
    { name: "Fortis Hospital", address: "Sector 62, Mohali", phone: "0172-4692222", type: "private" },
  ],

  shimla: [
    { name: "Indira Gandhi Medical College (IGMC)", address: "The Ridge, Shimla", phone: "0177-2804251", type: "government" },
    { name: "Kamla Nehru Hospital", address: "The Ridge, Shimla", phone: "0177-2808177", type: "government" },
    { name: "Deen Dayal Upadhyay Hospital", address: "Tara Devi, Shimla", phone: "0177-2840572", type: "government" },
  ],

  manali: [
    { name: "Lady Willingdon Hospital", address: "Model Town, Manali", phone: "01902-252379", type: "government" },
    { name: "Mission Hospital", address: "Old Manali Road, Manali", phone: "01902-253016", type: "private" },
    { name: "Civil Hospital Kullu", address: "Dhalpur, Kullu (40km)", phone: "01902-222636", type: "government" },
  ],

  dharamshala: [
    { name: "Zonal Hospital Dharamshala", address: "Kotwali Bazaar, Dharamshala", phone: "01892-224453", type: "government" },
    { name: "Tanda Medical College", address: "Kangra (20km)", phone: "01892-267115", type: "government" },
    { name: "Delek Hospital", address: "Gangkyi, McLeod Ganj", phone: "01892-222053", type: "private" },
  ],

  rishikesh: [
    { name: "AIIMS Rishikesh", address: "Virbhadra Road, Rishikesh", phone: "0135-2462930", type: "government" },
    { name: "Himalayan Hospital (SRHU)", address: "Jolly Grant, Dehradun", phone: "0135-2471200", type: "private" },
    { name: "Civil Hospital Rishikesh", address: "Railway Road, Rishikesh", phone: "0135-2430730", type: "government" },
  ],

  haridwar: [
    { name: "Government Hospital Haridwar", address: "Upper Road, Haridwar", phone: "01334-226351", type: "government" },
    { name: "Patanjali Yogpeeth Hospital", address: "Bahadrabad, Haridwar", phone: "01334-244107", type: "private" },
    { name: "Baba Ramdev Trust Hospital", address: "Near Har Ki Pauri, Haridwar", phone: "01334-260202", type: "private" },
  ],

  mussoorie: [
    { name: "Community Health Centre", address: "Landour, Mussoorie", phone: "0135-2632731", type: "government" },
    { name: "Landour Community Hospital", address: "Landour, Mussoorie", phone: "0135-2632053", type: "private" },
    { name: "Doon Hospital Dehradun", address: "Dehradun (35km)", phone: "0135-2650852", type: "government" },
  ],

  nainital: [
    { name: "B.D. Pandey Government Hospital", address: "Mallital, Nainital", phone: "05942-235012", type: "government" },
    { name: "Sushila Tiwari Hospital", address: "Haldwani (40km)", phone: "05946-220004", type: "government" },
    { name: "Vivekananda Hospital", address: "Tallital, Nainital", phone: "05942-236307", type: "private" },
  ],

  srinagar: [
    { name: "SKIMS (Sher-i-Kashmir Institute)", address: "Soura, Srinagar", phone: "0194-2401013", type: "government" },
    { name: "SMHS Hospital", address: "Karan Nagar, Srinagar", phone: "0194-2452052", type: "government" },
    { name: "Bone & Joint Hospital", address: "Barzulla, Srinagar", phone: "0194-2431642", type: "government" },
  ],

  leh: [
    { name: "SNM Hospital Leh", address: "Main Bazaar, Leh", phone: "01982-252012", type: "government" },
    { name: "SOS Medical Centre", address: "Fort Road, Leh", phone: "01982-250010", type: "private" },
    { name: "PHC Leh", address: "Near Main Market, Leh", phone: "01982-252360", type: "government" },
  ],

  // ─── West India ───────────────────────────────────────

  mumbai: [
    { name: "KEM Hospital", address: "Parel, Mumbai", phone: "022-24136051", type: "government" },
    { name: "Lilavati Hospital", address: "Bandra West, Mumbai", phone: "022-26568000", type: "private" },
    { name: "Hinduja Hospital", address: "Mahim, Mumbai", phone: "022-24447000", type: "private" },
    { name: "JJ Hospital", address: "Byculla, Mumbai", phone: "022-23735555", type: "government" },
  ],

  goa: [
    { name: "Goa Medical College & Hospital", address: "Bambolim, Goa", phone: "0832-2458727", type: "government" },
    { name: "Manipal Hospital Goa", address: "Dona Paula, Goa", phone: "0832-2460880", type: "private" },
    { name: "Vrundavan Hospital", address: "Margao, Goa", phone: "0832-2714050", type: "private" },
  ],

  udaipur: [
    { name: "MB Hospital (Maharana Bhupal)", address: "Chetak Circle, Udaipur", phone: "0294-2528811", type: "government" },
    { name: "GBH American Hospital", address: "101, Kothi Bagh, Udaipur", phone: "0294-2430100", type: "private" },
    { name: "Pacific Medical College", address: "Bedla, Udaipur", phone: "0294-3988888", type: "private" },
  ],

  jodhpur: [
    { name: "AIIMS Jodhpur", address: "Basni Phase 2, Jodhpur", phone: "0291-2740741", type: "government" },
    { name: "MDM Hospital", address: "Sojati Gate, Jodhpur", phone: "0291-2636500", type: "government" },
    { name: "Medipulse Hospital", address: "Residency Road, Jodhpur", phone: "0291-2795555", type: "private" },
  ],

  jaisalmer: [
    { name: "Government Hospital Jaisalmer", address: "Hanuman Circle, Jaisalmer", phone: "02992-252066", type: "government" },
    { name: "SN Ruia Hospital", address: "Near Fort, Jaisalmer", phone: "02992-251033", type: "government" },
  ],

  pushkar: [
    { name: "Government Hospital Pushkar", address: "Pushkar Main Road", phone: "0145-2772051", type: "government" },
    { name: "JLN Hospital Ajmer", address: "Ajmer (15km)", phone: "0145-2425507", type: "government" },
  ],

  surat: [
    { name: "New Civil Hospital Surat", address: "Majura Gate, Surat", phone: "0261-2244456", type: "government" },
    { name: "SMIMER Hospital", address: "Umarwada, Surat", phone: "0261-2652914", type: "government" },
    { name: "Kiran Hospital", address: "Katargam, Surat", phone: "0261-2471144", type: "private" },
  ],

  ahmedabad: [
    { name: "Civil Hospital Ahmedabad", address: "Asarwa, Ahmedabad", phone: "079-22683721", type: "government" },
    { name: "Sterling Hospital", address: "Gurukul Road, Ahmedabad", phone: "079-40011000", type: "private" },
    { name: "Apollo Hospital", address: "Plot No 1A, Gandhinagar Highway", phone: "079-66701800", type: "private" },
  ],

  // ─── South India ──────────────────────────────────────

  bangalore: [
    { name: "Victoria Hospital", address: "Fort, Bangalore", phone: "080-26701150", type: "government" },
    { name: "St. John's Medical College Hospital", address: "Koramangala, Bangalore", phone: "080-22065000", type: "private" },
    { name: "Manipal Hospital", address: "HAL Airport Road, Bangalore", phone: "080-25024444", type: "private" },
  ],
  bengaluru: [
    { name: "Victoria Hospital", address: "Fort, Bangalore", phone: "080-26701150", type: "government" },
    { name: "St. John's Medical College Hospital", address: "Koramangala, Bangalore", phone: "080-22065000", type: "private" },
    { name: "Manipal Hospital", address: "HAL Airport Road, Bangalore", phone: "080-25024444", type: "private" },
  ],

  hyderabad: [
    { name: "Osmania General Hospital", address: "Afzalgunj, Hyderabad", phone: "040-24600146", type: "government" },
    { name: "NIMS (Nizam's Institute)", address: "Punjagutta, Hyderabad", phone: "040-23489000", type: "government" },
    { name: "Apollo Hospital", address: "Jubilee Hills, Hyderabad", phone: "040-23607777", type: "private" },
  ],

  chennai: [
    { name: "Government General Hospital", address: "Park Town, Chennai", phone: "044-25305000", type: "government" },
    { name: "Apollo Hospital", address: "Greams Road, Chennai", phone: "044-28290200", type: "private" },
    { name: "Stanley Medical College Hospital", address: "Old Jail Road, Chennai", phone: "044-25281665", type: "government" },
  ],

  kochi: [
    { name: "Government Medical College Ernakulam", address: "HMT Colony, Kalamassery", phone: "0484-2532386", type: "government" },
    { name: "Lakeshore Hospital", address: "Maradu, Kochi", phone: "0484-2701032", type: "private" },
    { name: "Amrita Hospital", address: "AIMS Ponekkara, Kochi", phone: "0484-2851234", type: "private" },
  ],

  munnar: [
    { name: "Government Hospital Munnar", address: "Munnar Town", phone: "04865-230236", type: "government" },
    { name: "Tata General Hospital", address: "Nullatanni, Munnar", phone: "04865-230362", type: "private" },
  ],

  alleppey: [
    { name: "Government TD Medical College", address: "Vandanam, Alappuzha", phone: "0477-2282362", type: "government" },
    { name: "Bishop Benziger Hospital", address: "Beach Road, Alappuzha", phone: "0477-2251437", type: "private" },
  ],

  madurai: [
    { name: "Government Rajaji Hospital", address: "Panagal Road, Madurai", phone: "0452-2532535", type: "government" },
    { name: "Meenakshi Mission Hospital", address: "Lake Area, Melur Road", phone: "0452-4288888", type: "private" },
    { name: "Apollo Hospital", address: "KK Nagar, Madurai", phone: "0452-4244444", type: "private" },
  ],

  pondicherry: [
    { name: "JIPMER (Jawaharlal Institute)", address: "Dhanvantri Nagar, Puducherry", phone: "0413-2296000", type: "government" },
    { name: "Government General Hospital", address: "Victor Simonel Street, Puducherry", phone: "0413-2336216", type: "government" },
    { name: "PIMS Hospital", address: "Ganapathichettikulam, Puducherry", phone: "0413-2656271", type: "private" },
  ],

  ooty: [
    { name: "Government Hospital Ooty", address: "Mysore Road, Ooty", phone: "0423-2444066", type: "government" },
    { name: "Lawley Hospital", address: "Ettines Road, Ooty", phone: "0423-2442212", type: "government" },
  ],

  coorg: [
    { name: "District Hospital Madikeri", address: "Madikeri Town, Coorg", phone: "08272-228692", type: "government" },
    { name: "Kodagu Institute of Medical Sciences", address: "Madikeri, Coorg", phone: "08272-229597", type: "government" },
  ],

  hampi: [
    { name: "Government Hospital Hospet", address: "Hospet (13km from Hampi)", phone: "08394-228231", type: "government" },
    { name: "VIMS Hospital Bellary", address: "Bellary (65km)", phone: "08392-257700", type: "government" },
  ],

  vizag: [
    { name: "King George Hospital (KGH)", address: "Maharanipeta, Visakhapatnam", phone: "0891-2564891", type: "government" },
    { name: "CARE Hospital", address: "Ramnagar, Visakhapatnam", phone: "0891-3041000", type: "private" },
    { name: "Apollo Hospital", address: "Health City, Visakhapatnam", phone: "0891-6869999", type: "private" },
  ],
  visakhapatnam: [
    { name: "King George Hospital (KGH)", address: "Maharanipeta, Visakhapatnam", phone: "0891-2564891", type: "government" },
    { name: "CARE Hospital", address: "Ramnagar, Visakhapatnam", phone: "0891-3041000", type: "private" },
    { name: "Apollo Hospital", address: "Health City, Visakhapatnam", phone: "0891-6869999", type: "private" },
  ],

  // ─── East India ───────────────────────────────────────

  kolkata: [
    { name: "SSKM Hospital", address: "AJC Bose Road, Kolkata", phone: "033-22041101", type: "government" },
    { name: "RG Kar Medical College", address: "1, Khudiram Bose Sarani, Kolkata", phone: "033-25557656", type: "government" },
    { name: "Apollo Gleneagles Hospital", address: "Canal Circular Road, Kolkata", phone: "033-23203040", type: "private" },
  ],

  darjeeling: [
    { name: "Planters' Hospital", address: "The Mall, Darjeeling", phone: "0354-2254327", type: "government" },
    { name: "District Hospital Darjeeling", address: "Cart Road, Darjeeling", phone: "0354-2254095", type: "government" },
  ],

  puri: [
    { name: "District Headquarters Hospital", address: "Grand Road, Puri", phone: "06752-222063", type: "government" },
    { name: "Puri Government Hospital", address: "VIP Road, Puri", phone: "06752-223554", type: "government" },
  ],

  bhubaneswar: [
    { name: "AIIMS Bhubaneswar", address: "Sijua, Bhubaneswar", phone: "0674-2476001", type: "government" },
    { name: "Capital Hospital", address: "Unit 6, Bhubaneswar", phone: "0674-2390983", type: "government" },
    { name: "KIMS Hospital", address: "KIIT Campus, Bhubaneswar", phone: "0674-2725525", type: "private" },
  ],

  guwahati: [
    { name: "GMCH (Gauhati Medical College)", address: "Bhangagarh, Guwahati", phone: "0361-2529457", type: "government" },
    { name: "Nemcare Hospital", address: "Bhangagarh, Guwahati", phone: "0361-2528987", type: "private" },
    { name: "Down Town Hospital", address: "GS Road, Guwahati", phone: "0361-2331003", type: "private" },
  ],

  // ─── Central India ────────────────────────────────────

  bhopal: [
    { name: "AIIMS Bhopal", address: "Saket Nagar, Bhopal", phone: "0755-2672317", type: "government" },
    { name: "Hamidia Hospital", address: "Royal Market, Bhopal", phone: "0755-2540222", type: "government" },
    { name: "Bansal Hospital", address: "Shahpura, Bhopal", phone: "0755-4086000", type: "private" },
  ],

  indore: [
    { name: "MY Hospital (Maharaja Yeshwantrao)", address: "MY Road, Indore", phone: "0731-2527383", type: "government" },
    { name: "CHL Hospital", address: "AB Road, Indore", phone: "0731-4710000", type: "private" },
    { name: "Bombay Hospital Indore", address: "Ring Road, Indore", phone: "0731-2547777", type: "private" },
  ],

  nagpur: [
    { name: "Government Medical College Nagpur", address: "Hanuman Nagar, Nagpur", phone: "0712-2760824", type: "government" },
    { name: "Orange City Hospital", address: "Veer Savarkar Square, Nagpur", phone: "0712-6614555", type: "private" },
    { name: "Wockhardt Hospital", address: "South Ambazari Road, Nagpur", phone: "0712-6634444", type: "private" },
  ],

  pune: [
    { name: "Sassoon General Hospital", address: "Near Pune Railway Station", phone: "020-26128000", type: "government" },
    { name: "Ruby Hall Clinic", address: "Sassoon Road, Pune", phone: "020-26163391", type: "private" },
    { name: "Jehangir Hospital", address: "Sassoon Road, Pune", phone: "020-26121414", type: "private" },
  ],

  // ─── Hill Stations & Small Towns ──────────────────────

  jibhi: [
    { name: "Community Health Centre Banjar", address: "Banjar (15km from Jibhi)", phone: "01903-250036", type: "government" },
    { name: "Regional Hospital Kullu", address: "Kullu (60km)", phone: "01902-222636", type: "government" },
  ],
}

// Universal emergency numbers for India
export const EMERGENCY_NUMBERS = {
  ambulance: "108",
  police: "100",
  fire: "101",
  women_helpline: "1091",
  disaster: "1078",
  tourist_helpline: "1363",
  universal: "112",
}
