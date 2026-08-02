/**
 * Cascading Pakistan locations: Province → Region → District → City
 * Tuned for BanoQabil (South Punjab / Vehari) with national coverage.
 */

export type LocationTree = Record<
  string,
  Record<string, Record<string, string[]>>
>;

export const PAKISTAN_LOCATIONS: LocationTree = {
  Punjab: {
    'South Punjab': {
      Vehari: ['Vehari', 'Burewala', 'Mailsi', 'Gaggo Mandi', 'Luddan', 'Tibba Sultanpur'],
      Multan: ['Multan', 'Shujabad', 'Jalalpur Pirwala', 'Qadirpur Ran'],
      Khanewal: ['Khanewal', 'Kabirwala', 'Mian Channu', 'Jahanian'],
      Lodhran: ['Lodhran', 'Dunyapur', 'Kahror Pacca'],
      Bahawalpur: ['Bahawalpur', 'Hasilpur', 'Yazman', 'Khairpur Tamewali', 'Ahmadpur East'],
      Bahawalnagar: ['Bahawalnagar', 'Chishtian', 'Haroonabad', 'Fort Abbas', 'Minchinabad'],
      'Rahim Yar Khan': ['Rahim Yar Khan', 'Sadiqabad', 'Khanpur', 'Liaquatpur'],
      'Dera Ghazi Khan': ['Dera Ghazi Khan', 'Taunsa', 'Kot Chutta'],
      Muzaffargarh: ['Muzaffargarh', 'Kot Addu', 'Alipur', 'Jatoi'],
      Layyah: ['Layyah', 'Karor Lal Esan', 'Chowk Azam', 'Fatehpur'],
      Rajanpur: ['Rajanpur', 'Jampur', 'Rojhan'],
      'Pakpattan': ['Pakpattan', 'Arifwala'],
      Okara: ['Okara', 'Depalpur', 'Renala Khurd'],
      Sahiwal: ['Sahiwal', 'Chichawatni'],
    },
    'Central Punjab': {
      Lahore: ['Lahore', 'Raiwind', 'Wagah'],
      Kasur: ['Kasur', 'Pattoki', 'Chunian'],
      Sheikhupura: ['Sheikhupura', 'Muridke', 'Ferozewala', 'Sharqpur'],
      'Nankana Sahib': ['Nankana Sahib', 'Sangla Hill', 'Shahkot'],
      Faisalabad: ['Faisalabad', 'Jaranwala', 'Samundri', 'Tandlianwala', 'Khurrianwala'],
      Jhang: ['Jhang', 'Shorkot', 'Ahmadpur Sial'],
      'Toba Tek Singh': ['Toba Tek Singh', 'Gojra', 'Kamalia', 'Pir Mahal'],
      Chiniot: ['Chiniot', 'Bhowana', 'Lalian'],
      Sargodha: ['Sargodha', 'Bhalwal', 'Shahpur', 'Sahiwal (Sargodha)', 'Kot Momin'],
      Khushab: ['Khushab', 'Jauharabad', 'Noorpur Thal', 'Quaidabad'],
      Mianwali: ['Mianwali', 'Piplan', 'Isa Khel'],
      Bhakkar: ['Bhakkar', 'Darya Khan', 'Kallur Kot', 'Mankera'],
    },
    'North Punjab': {
      Rawalpindi: ['Rawalpindi', 'Taxila', 'Murree', 'Gujar Khan', 'Kahuta'],
      Attock: ['Attock', 'Hazro', 'Hassan Abdal', 'Pindi Gheb', 'Jand'],
      Jhelum: ['Jhelum', 'Dina', 'Sohawa', 'Pind Dadan Khan'],
      Chakwal: ['Chakwal', 'Talagang', 'Choa Saidan Shah', 'Kallar Kahar'],
      Gujranwala: ['Gujranwala', 'Kamoke', 'Wazirabad', 'Nowshera Virkan', 'Qila Didar Singh'],
      Sialkot: ['Sialkot', 'Daska', 'Sambrial', 'Pasrur'],
      Narowal: ['Narowal', 'Shakargarh', 'Zafarwal'],
      Gujrat: ['Gujrat', 'Kharian', 'Sarai Alamgir', 'Jalalpur Jattan'],
      'Mandi Bahauddin': ['Mandi Bahauddin', 'Phalia', 'Malakwal'],
      Hafizabad: ['Hafizabad', 'Pindi Bhattian'],
    },
  },
  Sindh: {
    'Karachi Division': {
      'Karachi Central': ['North Nazimabad', 'Gulberg', 'Liaquatabad', 'New Karachi'],
      'Karachi East': ['Gulshan-e-Iqbal', 'Gulistan-e-Johar', 'Shah Faisal'],
      'Karachi South': ['Saddar', 'Clifton', 'Defence', 'Lyari'],
      'Karachi West': ['Orangi', 'SITE', 'Baldia'],
      Korangi: ['Korangi', 'Landhi', 'Shah Faisal Colony'],
      Malir: ['Malir', 'Gadap', 'Bin Qasim'],
    },
    'Hyderabad Region': {
      Hyderabad: ['Hyderabad', 'Latifabad', 'Qasimabad'],
      Jamshoro: ['Jamshoro', 'Kotri', 'Sehwan'],
      Thatta: ['Thatta', 'Makli'],
      Badin: ['Badin', 'Matli', 'Talhar'],
      'Tando Allahyar': ['Tando Allahyar', 'Chamber'],
      'Tando Muhammad Khan': ['Tando Muhammad Khan'],
      Matiari: ['Matiari', 'Hala'],
    },
    'Sukkur Region': {
      Sukkur: ['Sukkur', 'Rohri', 'Pano Aqil'],
      Ghotki: ['Ghotki', 'Mirpur Mathelo', 'Daharki'],
      Khairpur: ['Khairpur', 'Kot Diji', 'Gambat'],
      'Shaheed Benazirabad': ['Nawabshah', 'Sakrand', 'Daur'],
      'Naushahro Feroze': ['Naushahro Feroze', 'Moro', 'Kandiaro'],
    },
    'Larkana Region': {
      Larkana: ['Larkana', 'Ratodero', 'Dokri'],
      Shikarpur: ['Shikarpur', 'Lakhi', 'Garhi Yasin'],
      Jacobabad: ['Jacobabad', 'Thul'],
      Kashmore: ['Kashmore', 'Kandhkot'],
      'Qambar Shahdadkot': ['Qambar', 'Shahdadkot', 'Mirokhan'],
    },
  },
  'Khyber Pakhtunkhwa': {
    'Peshawar Region': {
      Peshawar: ['Peshawar', 'Hayatabad', 'Charsadda Road'],
      Nowshera: ['Nowshera', 'Pabbi', 'Jehangira'],
      Charsadda: ['Charsadda', 'Tangi', 'Shabqadar'],
      Mardan: ['Mardan', 'Takht Bhai', 'Katlang'],
      Swabi: ['Swabi', 'Topi', 'Lahore (Swabi)'],
    },
    'Hazara Region': {
      Abbottabad: ['Abbottabad', 'Havelian', 'Nathiagali'],
      Mansehra: ['Mansehra', 'Balakot', 'Oghi'],
      Haripur: ['Haripur', 'Ghazi', 'Khanpur'],
      Battagram: ['Battagram', 'Allai'],
      Kohistan: ['Dassu', 'Pattan', 'Palas'],
    },
    'Malakand Region': {
      Swat: ['Mingora', 'Saidu Sharif', 'Bahrain', 'Kalam'],
      Dir: ['Timergara', 'Dir', 'Chakdara'],
      Chitral: ['Chitral', 'Booni', 'Drosh'],
      Buner: ['Daggar', 'Totalai'],
      Shangla: ['Alpuri', 'Puran'],
    },
  },
  Balochistan: {
    'Quetta Region': {
      Quetta: ['Quetta', 'Sariab', 'Hudda'],
      Pishin: ['Pishin', 'Huramzai'],
      'Qilla Abdullah': ['Qilla Abdullah', 'Chaman'],
      Zhob: ['Zhob', 'Muslim Bagh'],
    },
    'Kalat Region': {
      Kalat: ['Kalat', 'Manguchar'],
      Khuzdar: ['Khuzdar', 'Wadh'],
      Lasbela: ['Uthal', 'Hub', 'Bela'],
      Awaran: ['Awaran'],
    },
    'Makran Region': {
      Gwadar: ['Gwadar', 'Pasni', 'Ormara'],
      Turbat: ['Turbat', 'Tump'],
      Panjgur: ['Panjgur'],
    },
  },
  'Islamabad Capital Territory': {
    Islamabad: {
      Islamabad: [
        'Islamabad',
        'F-6',
        'F-7',
        'F-8',
        'F-10',
        'F-11',
        'G-8',
        'G-9',
        'G-10',
        'G-11',
        'I-8',
        'I-9',
        'I-10',
        'Bahria Town',
        'DHA',
      ],
    },
  },
  'Azad Jammu & Kashmir': {
    'Muzaffarabad Region': {
      Muzaffarabad: ['Muzaffarabad', 'Patika'],
      Neelum: ['Athmuqam', 'Sharda'],
      Hattian: ['Hattian Bala', 'Chinari'],
    },
    'Mirpur Region': {
      Mirpur: ['Mirpur', 'New Mirpur City'],
      Bhimber: ['Bhimber', 'Samahni'],
      Kotli: ['Kotli', 'Sehnsa', 'Fatehpur Thakiala'],
    },
  },
  'Gilgit-Baltistan': {
    Gilgit: {
      Gilgit: ['Gilgit', 'Danyore', 'Jutial'],
      Hunza: ['Karimabad', 'Aliabad', 'Gulmit'],
      Nagar: ['Nagar', 'Askole'],
    },
    Baltistan: {
      Skardu: ['Skardu', 'Satpara'],
      Ghanche: ['Khaplu', 'Mashabrum'],
      Shigar: ['Shigar'],
    },
  },
};

export function getProvinces(): string[] {
  return Object.keys(PAKISTAN_LOCATIONS);
}

export function getRegions(province: string): string[] {
  const node = PAKISTAN_LOCATIONS[province];
  return node ? Object.keys(node) : [];
}

export function getDistricts(province: string, region: string): string[] {
  const node = PAKISTAN_LOCATIONS[province]?.[region];
  return node ? Object.keys(node) : [];
}

export function getCities(province: string, region: string, district: string): string[] {
  return PAKISTAN_LOCATIONS[province]?.[region]?.[district] ?? [];
}

/** Keep legacy / free-text values selectable when editing old rows. */
export function withCurrentOption(options: string[], current: string): string[] {
  const value = current.trim();
  if (!value) return options;
  if (options.includes(value)) return options;
  return [value, ...options];
}
