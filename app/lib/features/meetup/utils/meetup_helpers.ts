import { FirestoreMeetupEvent, MeetupEvent } from '../types/meetup_types';

// Convert Firestore Timestamp to date and time strings
export const convertTimestampToDateTime = (timestamp: any): { date: string; time: string } => {
  let date: Date;
  
  if (timestamp && typeof timestamp.toDate === 'function') {
    // Firestore Timestamp
    date = timestamp.toDate();
  } else if (timestamp && timestamp.seconds) {
    // Firestore Timestamp object
    date = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === 'string') {
    // ISO string
    date = new Date(timestamp);
  } else {
    // Fallback to current date
    date = new Date();
  }

  const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeString = date.toTimeString().slice(0, 5); // HH:MM
  
  return { date: dateString, time: timeString };
};

// Convert Firestore document to UI format
export const convertFirestoreToMeetupEvent = (doc: FirestoreMeetupEvent | any): MeetupEvent => {
  const { date, time } = convertTimestampToDateTime(doc.date_time);

  let location_name: string;
  let location_address: string;
  let location_map_url: string;
  let latitude: number;
  let longitude: number;
  let location_extra_info: string;

  // Check if the new top-level fields exist (for new/updated data)
  if (doc.location_name !== undefined && doc.latitude !== undefined && doc.longitude !== undefined) {
    location_name = doc.location_name;
    location_address = doc.location_address;
    location_map_url = doc.location_map_url;
    latitude = doc.latitude;
    longitude = doc.longitude;
    location_extra_info = doc.location_extra_info;
  } else if (doc.location && Array.isArray(doc.location) && doc.location.length >= 5) {
    // Fallback to the old array structure (for existing data)
    location_name = doc.location[0];
    location_address = doc.location[1];
    location_map_url = doc.location[2];
    latitude = typeof doc.location[3] === 'number' ? doc.location[3] : 0;
    longitude = typeof doc.location[4] === 'number' ? doc.location[4] : 0;
    location_extra_info = doc.location[5] || '';
  } else {
    // Default values if neither structure is found (should ideally not happen)
    location_name = 'N/A';
    location_address = 'N/A';
    location_map_url = '';
    latitude = 0;
    longitude = 0;
    location_extra_info = '';
  }

  return {
    id: doc.id,
    title: doc.title,
    date,
    time,
    description: doc.description,
    location_name,
    location_address,
    location_map_url,
    latitude,
    longitude,
    location_extra_info,
    duration_minutes: doc.duration_minutes,
    lockdown_minutes: doc.lockdown_minutes,
    max_participants: doc.max_participants,
    participants: doc.participants || [], // Added safety for participants
    leaders: doc.leaders || [], // Added safety for leaders
    image_urls: doc.image_urls || [], // Added safety for image_urls
    topics: doc.topics || [], // Added safety for topics
    articles: doc.articles || [] // Added safety for articles
  };
};

// Sample Firestore documents based on your schema
export const sampleFirestoreEvents: Record<string, FirestoreMeetupEvent> = {
  'wst_korea_univ_001': {
    id: 'wst_korea_univ_001',
    date_time: new Date('2024-02-07T17:00:00+09:00').toISOString(),
    description: '월가 담화에서는 The Wall Street Journal에서 기사 2개를 선정하여 각각 1시간씩, 총 2시간 토의를 합니다. 비즈니스 영어와 시사 토론 실력을 향상시키고 싶은 분들에게 완벽한 기회입니다.',
    duration_minutes: 120,
    image_urls: [
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop'
    ],
    leaders: ['3875867942'],
    location_name: '스타벅스 고대안암병원점',
    location_address: '서울특별시 성북구 안암동5가 126-1',
    location_map_url: 'nmap://search?query=%EC%8A%A4%ED%83%80%EB%B2%85%EC%8A%A4%20%EA%B3%A0%EB%8C%80%EC%95%88%EC%95%94%EB%B3%91%EC%9B%90%EC%A0%90&zoom=15',
    latitude: 37.5871583,
    longitude: 127.0270049,
    location_extra_info: '고대병원 입구 쪽',
    lockdown_minutes: 0,
    max_participants: 30,
    participants: ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8'],
    title: 'WST Korea Univ | 월가 담화 고려대 정모',
    topics: [
      { topic_id: 'DOAwVGpAXcbC9UKIXJ8m' },
      { topic_id: 'TC8wkLHs9yqKnFREIWu6' }
    ],
    articles: []
  },
  'english_speaking_practice_001': {
    id: 'english_speaking_practice_001',
    date_time: new Date('2024-01-15T19:00:00+09:00').toISOString(),
    description: 'Join us for a relaxed English conversation practice session. Perfect for beginners who want to improve their speaking confidence in a supportive environment.',
    duration_minutes: 90,
    image_urls: [
      'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=600&fit=crop'
    ],
    leaders: ['leader_emma'],
    location_name: '강남역 2번 출구 스타벅스',
    location_address: '서울특별시 강남구 강남대로 지하 396',
    location_map_url: 'https://map.naver.com/v5/search/강남역%202번출구',
    latitude: 37.4979,
    longitude: 127.0276,
    location_extra_info: '지하철 출구에서 도보 1분',
    lockdown_minutes: 10,
    max_participants: 15,
    participants: ['user1', 'user2', 'user3', 'user4', 'user5'],
    title: 'English Speaking Practice - Beginner Friendly',
    topics: [
      { topic_id: 'daily_routines_topic' },
      { topic_id: 'travel_culture_topic' }
    ],
    articles: []
  },
  'business_english_workshop_001': {
    id: 'business_english_workshop_001',
    date_time: new Date('2024-01-20T14:00:00+09:00').toISOString(),
    description: 'Learn essential business English phrases and practice professional communication skills. Great for working professionals looking to advance their careers.',
    duration_minutes: 180,
    image_urls: [
      'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&h=600&fit=crop'
    ],
    leaders: ['leader_david'],
    location_name: '홍대문화공간',
    location_address: '서울특별시 마포구 와우산로 29길 19',
    location_map_url: 'https://map.naver.com/v5/search/홍대문화공간',
    latitude: 37.5563,
    longitude: 126.9234,
    location_extra_info: '홍익대학교 정문에서 도보 5분',
    lockdown_minutes: 30,
    max_participants: 12,
    participants: ['user1', 'user2', 'user3'],
    title: 'Business English Workshop',
    topics: [
      { topic_id: 'business_communication_topic' },
      { topic_id: 'presentation_skills_topic' }
    ],
    articles: []
  },
  'movie_night_discussion_001': {
    id: 'movie_night_discussion_001',
    date_time: new Date('2024-01-25T18:30:00+09:00').toISOString(),
    description: 'Watch an English movie together and discuss it afterwards. Improve your listening skills while having fun! Popcorn and drinks included.',
    duration_minutes: 150,
    image_urls: [
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&h=600&fit=crop'
    ],
    leaders: ['leader_rachel'],
    location_name: '명동커뮤니티센터',
    location_address: '서울특별시 중구 명동2가 54-1',
    location_map_url: 'https://map.naver.com/v5/search/명동커뮤니티센터',
    latitude: 37.5636,
    longitude: 126.9831,
    location_extra_info: '명동역 6번 출구에서 도보 3분',
    lockdown_minutes: 0,
    max_participants: 20,
    participants: [
      'user1', 'user2', 'user3', 'user4', 'user5', 
      'user6', 'user7', 'user8', 'user9', 'user10',
      'user11', 'user12', 'user13', 'user14', 'user15',
      'user16', 'user17', 'user18', 'user19', 'user20'
    ],
    title: 'English Movie Night & Discussion',
    topics: [
      { topic_id: 'movie_analysis_topic' },
      { topic_id: 'character_discussion_topic' }
    ],
    articles: []
  }
};

// Helper function to check if event has already started
export const hasEventStarted = (event: MeetupEvent): boolean => {
  const eventDateTime = new Date(`${event.date}T${event.time}`);
  const now = new Date();
  
  return now >= eventDateTime;
};

// Helper function to check if event is locked down
export const isEventLockedDown = (event: MeetupEvent): boolean => {
  // Check if event has already started
  if (hasEventStarted(event)) return true;
  
  // Check lockdown time before event start
  if (event.lockdown_minutes === 0) return false;
  
  const eventDateTime = new Date(`${event.date}T${event.time}`);
  const lockdownTime = new Date(eventDateTime.getTime() - (event.lockdown_minutes * 60 * 1000));
  const now = new Date();
  
  return now >= lockdownTime;
};

// Helper function to check if event should be locked (comprehensive check)
export const isEventLocked = (event: MeetupEvent): { isLocked: boolean; reason: 'started' | 'full' | 'lockdown' | null } => {
  // Check if event has already started
  if (hasEventStarted(event)) {
    return { isLocked: true, reason: 'started' };
  }
  
  // Check if event is full (participants + leaders >= max_participants)
  const totalOccupied = event.participants.length + event.leaders.length;
  if (totalOccupied >= event.max_participants) {
    return { isLocked: true, reason: 'full' };
  }
  
  // Check lockdown time before event start
  if (event.lockdown_minutes > 0) {
    const eventDateTime = new Date(`${event.date}T${event.time}`);
    const lockdownTime = new Date(eventDateTime.getTime() - (event.lockdown_minutes * 60 * 1000));
    const now = new Date();
    
    if (now >= lockdownTime) {
      return { isLocked: true, reason: 'lockdown' };
    }
  }
  
  return { isLocked: false, reason: null };
};

// Helper function to format date and time for display
export const formatEventDateTime = (event: MeetupEvent): string => {
  const date = new Date(`${event.date}T${event.time}`);
  
  // Korean date formatting
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Korean day of week
  const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const weekday = weekdays[date.getDay()];
  
  // Korean time formatting (24-hour format)
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${year}년 ${month}월 ${day}일 (${weekday}) ${hours}:${minutes}`;
};

// Helper function to preserve line breaks in text for display
export const formatTextWithLineBreaks = (text: string): string => {
  // This function can be used to convert newlines to HTML breaks if needed
  // For now, we rely on CSS white-space: pre-wrap
  return text;
};

// Helper function to calculate days until event starts
export const getDaysUntilEvent = (event: MeetupEvent): number => {
  const now = new Date();
  
  // Calculate difference in days (ignore time, just focus on date difference)
  const eventDateOnly = new Date(event.date);
  const nowDateOnly = new Date(now.toISOString().split('T')[0]);
  
  const timeDiff = eventDateOnly.getTime() - nowDateOnly.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  return daysDiff;
};

// Helper function to format event title with countdown
export const formatEventTitleWithCountdown = (event: MeetupEvent): { 
  countdownPrefix: string;
  eventTitle: string;
  isUrgent: boolean; 
  daysUntil: number;
} => {
  const daysUntil = getDaysUntilEvent(event);
  let countdownPrefix = '';
  let isUrgent = false;
  
  // Only show countdown for future events or today
  if (daysUntil > 0) {
    countdownPrefix = `[D-${daysUntil}] `;
    isUrgent = daysUntil <= 3; // Mark as urgent if 3 days or less
  } else if (daysUntil === 0) {
    countdownPrefix = '[D-DAY] ';
    isUrgent = true;
  } else {
    // Event has passed, no countdown prefix
    countdownPrefix = '';
  }
  
  return {
    countdownPrefix,
    eventTitle: event.title,
    isUrgent,
    daysUntil
  };
};

// Sample topics data (this would normally come from a separate collection)
export const sampleTopics = {
  'DOAwVGpAXcbC9UKIXJ8m': {
    id: 'DOAwVGpAXcbC9UKIXJ8m',
    title: 'AI and the Future of Work',
    url: 'https://www.wsj.com/articles/ai-future-work-automation',
    discussion_points: [
      'How will AI change traditional job roles?',
      'What skills should workers develop for the AI era?',
      'Should there be regulations on AI in the workplace?',
      'How can companies prepare for AI integration?'
    ]
  },
  'TC8wkLHs9yqKnFREIWu6': {
    id: 'TC8wkLHs9yqKnFREIWu6',
    title: 'Global Economic Outlook for 2024',
    url: 'https://www.wsj.com/articles/global-economy-2024-outlook',
    discussion_points: [
      'What are the key economic challenges facing major economies?',
      'How might interest rate changes affect global markets?',
      'What role will emerging markets play in 2024?',
      'How should investors position themselves?'
    ]
  },
  'daily_routines_topic': {
    id: 'daily_routines_topic',
    title: 'Daily Routines and Habits',
    discussion_points: [
      'What time do you usually wake up and why?',
      'Describe your morning routine',
      'What habits would you like to develop?',
      'How do you stay productive during the day?'
    ]
  },
  'travel_culture_topic': {
    id: 'travel_culture_topic',
    title: 'Travel and Cultural Experiences',
    discussion_points: [
      'What is your favorite travel destination?',
      'Describe a cultural difference you found interesting',
      'What would you like to explore in other countries?',
      'How do you prepare for international travel?'
    ]
  },
  'business_communication_topic': {
    id: 'business_communication_topic',
    title: 'Professional Communication Skills',
    discussion_points: [
      'How do you handle difficult conversations at work?',
      'What makes an effective business email?',
      'How do you build rapport with international colleagues?',
      'What are common communication mistakes in business?'
    ]
  },
  'presentation_skills_topic': {
    id: 'presentation_skills_topic',
    title: 'Effective Presentation Techniques',
    discussion_points: [
      'How do you overcome presentation anxiety?',
      'What makes a presentation memorable?',
      'How do you engage your audience effectively?',
      'What visual aids work best for different topics?'
    ]
  },
  'movie_analysis_topic': {
    id: 'movie_analysis_topic',
    title: 'Film Analysis and Critique',
    discussion_points: [
      'What themes did you identify in the movie?',
      'How effective was the storytelling technique?',
      'What cultural elements were portrayed?',
      'How did the cinematography enhance the story?'
    ]
  },
  'character_discussion_topic': {
    id: 'character_discussion_topic',
    title: 'Character Development Discussion',
    discussion_points: [
      'Which character did you relate to most and why?',
      'How did the main character change throughout the story?',
      'What motivated the antagonist\'s actions?',
      'Were the character relationships realistic?'
    ]
  }
}; 