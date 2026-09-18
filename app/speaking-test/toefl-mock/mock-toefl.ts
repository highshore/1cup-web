export type ExamSection = "Pre-test" | "Reading" | "Listening" | "Writing" | "Speaking";

export type ExamStepKind =
  | "welcome"
  | "hardware"
  | "volume_instructions"
  | "volume_adjusted"
  | "mic_instructions"
  | "mic_record"
  | "mic_success"
  | "section_intro"
  | "reading_cloze"
  | "reading_daily"
  | "reading_academic"
  | "section_end"
  | "listening_response"
  | "listening_stimulus"
  | "listening_question"
  | "writing_instructions"
  | "build_sentence"
  | "email"
  | "discussion"
  | "speaking_instructions"
  | "speaking_scenario"
  | "speaking_prompt"
  | "speaking_record"
  | "speaking_save";

export type MockOption = { id: string; label: string };
export type MockPost = { name: string; text: string; avatarLabel?: string };

export type ExamStep = {
  id: string;
  kind: ExamStepKind;
  section: ExamSection;
  title?: string;
  body?: string[];
  taskRows?: Array<[string, string]>;
  progressLabel?: string;
  actionLabel?: string;
  questionNumber?: number;
  questionRange?: string;
  questionText?: string;
  options?: MockOption[];
  passageTitle?: string;
  passage?: string[];
  clozeParts?: string[];
  stimulusTitle?: string;
  stimulusBody?: string[];
  mediaLabel?: string;
  mediaType?: "audio" | "image" | "video" | "avatar";
  instruction?: string;
  tokens?: string[];
  correctOrder?: string[];
  emailScenario?: string[];
  requirements?: string[];
  recipient?: string;
  subject?: string;
  professorPrompt?: string[];
  posts?: MockPost[];
  responseSeconds?: number;
  module?: 1 | 2;
};

const choices = (...labels: string[]): MockOption[] =>
  labels.map((label, index) => ({ id: String.fromCharCode(65 + index), label }));

const academicPassageOne = [
  "Community seed libraries allow gardeners to borrow seeds, grow plants, and return seeds collected at the end of the season.",
  "Unlike commercial seed banks, these small programs are usually organized through public libraries, schools, or neighborhood groups. Their goal is not only to distribute seeds but also to preserve plant varieties that perform well in local conditions.",
  "A seed library becomes more useful when participants record information about soil, weather, harvest time, and plant traits. Over several growing seasons, these notes can reveal which varieties tolerate heat, resist disease, or produce reliably in a particular area.",
  "The system does have limitations. Seeds can be mislabeled, some plants cross-pollinate easily, and inexperienced gardeners may collect seeds before they are mature.",
  "For that reason, successful programs combine seed sharing with simple training and careful record keeping. The result is both a practical resource and a form of community knowledge.",
];

const academicPassageTwo = [
  "Urban trees can influence a city's local climate in several ways. Their leaves block solar radiation from reaching roads and building surfaces, while water released from leaves can cool the surrounding air.",
  "The effect is not uniform. A dense tree canopy can provide strong shade during hot afternoons, but the same canopy may reduce nighttime heat loss from streets.",
  "Researchers therefore evaluate tree placement together with street width, building height, wind direction, and local rainfall.",
  "A successful urban forestry plan balances cooling, water use, maintenance, biodiversity, and pedestrian comfort rather than maximizing tree cover alone.",
];

const dailyStimuli = [
  {
    title: "Municipal Charter",
    body: [
      "Pay your paperless billing statement today.",
      "Fast, convenient online access to monthly statements.",
      "Secure account services are available from the mobile app.",
    ],
    question: "What type of business most likely issued the notice?",
    options: choices("An Internet provider", "A computer company", "A bank", "A bookstore"),
  },
  {
    title: "Campus Library Notice",
    body: [
      "The second-floor study area will close at 6:00 p.m. on Friday.",
      "The first floor and digital media lab will remain open until 10:00 p.m.",
    ],
    question: "What should students do if they need to study after 6:00 p.m.?",
    options: choices("Use another open area", "Ask for a refund", "Return on Monday", "Reserve the closed floor"),
  },
  {
    title: "Neighborhood Café",
    body: [
      "Weekend special: soup, salad, and tea for $12.",
      "Orders placed before 11:30 a.m. include a free pastry.",
    ],
    question: "How can a customer receive the free pastry?",
    options: choices("Visit on a weekday", "Order before 11:30 a.m.", "Buy two drinks", "Use a mobile coupon"),
  },
  {
    title: "Community Center Email",
    body: [
      "Your photography workshop has moved from Room 204 to Room 118.",
      "The date and starting time have not changed.",
    ],
    question: "What changed about the workshop?",
    options: choices("The room", "The date", "The instructor", "The starting time"),
  },
  {
    title: "Transit Update",
    body: [
      "Bus 42 will skip Pine Street between 2:00 and 4:00 p.m. because of road work.",
      "Passengers may use the temporary stop on Oak Avenue.",
    ],
    question: "Why should some passengers use Oak Avenue?",
    options: choices("Bus 42 is temporarily rerouted", "Fares are lower there", "A new line begins there", "Pine Street closes permanently"),
  },
];

const dailyStimuliTwo = [
  {
    title: "Fitness Center Update",
    body: [
      "The pool will be closed Tuesday morning for maintenance.",
      "All other facilities will open at the usual time.",
    ],
    question: "Which facility will be unavailable Tuesday morning?",
    options: choices("The pool", "The gym", "The café", "The locker rooms"),
  },
  {
    title: "Volunteer Message",
    body: [
      "Please arrive 15 minutes before the river cleanup begins.",
      "Gloves and trash bags will be provided at the registration table.",
    ],
    question: "What will organizers provide?",
    options: choices("Gloves and bags", "Transportation", "Lunch vouchers", "Rain jackets"),
  },
  {
    title: "Bookstore Promotion",
    body: [
      "Students receive 15% off used textbooks through Friday.",
      "The discount does not apply to electronics or course packets.",
    ],
    question: "What is included in the promotion?",
    options: choices("Used textbooks", "Electronics", "Course packets", "Printing services"),
  },
  {
    title: "Apartment Notice",
    body: [
      "Water service may be interrupted from 1:00 to 3:00 p.m. Thursday.",
      "The management office recommends storing enough water in advance.",
    ],
    question: "What are residents advised to do?",
    options: choices("Store water beforehand", "Leave the building", "Contact the city", "Pay a maintenance fee"),
  },
  {
    title: "Museum Schedule",
    body: [
      "The east gallery closes at 4:00 p.m. for a private event.",
      "The west gallery and sculpture garden remain open until 7:00 p.m.",
    ],
    question: "Which area closes early?",
    options: choices("The east gallery", "The west gallery", "The sculpture garden", "The gift shop"),
  },
];

const academicQuestionsOne = [
  ["What is the passage mainly about?", choices("How community seed libraries work and what makes them useful", "Why commercial farms avoid public libraries", "How to design a school greenhouse", "Why gardeners should buy new seeds each year")],
  ["Why are participant notes useful to a seed library?", choices("They help identify varieties suited to local conditions", "They guarantee that every seed will germinate", "They replace the need to label seeds", "They prevent all cross-pollination")],
  ["Which limitation of seed libraries is mentioned?", choices("Seeds may be mislabeled", "Libraries cannot store paper records", "Gardeners are not allowed to return seeds", "Local plants always require greenhouses")],
  ["What does the passage suggest successful programs provide in addition to seeds?", choices("Basic training and record-keeping guidance", "Commercial farming equipment", "Guaranteed harvest insurance", "Professional landscaping services")],
  ["What can be inferred about community seed libraries?", choices("Their value can increase as local knowledge accumulates", "They work only in cold climates", "They are intended mainly for commercial farmers", "They eliminate the need for seed companies")],
] as const;

const academicQuestionsTwo = [
  ["What is the passage mainly about?", choices("How urban tree planning involves several trade-offs", "Why cities should remove street trees", "How to measure building height", "Why rainfall is decreasing")],
  ["According to the passage, how can leaves cool a city?", choices("By providing shade and releasing water", "By increasing road temperature", "By blocking wind permanently", "By reducing rainfall")],
  ["Why might dense tree cover have a different effect at night?", choices("It may reduce heat loss from streets", "It makes streets wider", "It increases traffic", "It removes moisture from air")],
  ["Which factor is NOT mentioned as part of tree-placement analysis?", choices("Street width", "Building height", "Wind direction", "Subway frequency")],
  ["What does the author suggest about maximizing tree cover?", choices("It is not always the best single goal", "It is always the cheapest strategy", "It eliminates maintenance", "It removes the need for planning")],
] as const;

const sentenceTasks = [
  ["The research team", "finished", "the project", "because", "the members worked together."],
  ["The professor", "asked", "the students", "to submit", "their drafts by Friday."],
  ["The new policy", "will help", "residents", "reduce", "household waste."],
  ["Many commuters", "choose", "the train", "because", "it is more reliable."],
  ["The museum", "extended", "its hours", "so that", "more visitors could attend."],
  ["Our group", "decided", "to postpone", "the meeting", "until next week."],
  ["The experiment", "produced", "unexpected results", "after", "the temperature changed."],
  ["The city", "plans", "to add", "more bike lanes", "next year."],
  ["She", "recommended", "taking notes", "while", "listening to the lecture."],
  ["The company", "introduced", "a flexible schedule", "to improve", "employee satisfaction."],
];

const interviewQuestions = [
  "Do you currently live in a big city, a small town, or a village?",
  "Some people find cities dynamic and exciting. What kind of reaction do you have to cities, and why?",
  "Do you agree that people who live in cities lead more interesting lives? Why or why not?",
  "Should city governments create more parks in urban areas to promote happiness and life satisfaction? Why or why not?",
];

export function buildMockToeflSteps(): ExamStep[] {
  const steps: ExamStep[] = [
    { id: "welcome", kind: "welcome", section: "Pre-test", title: "Welcome to the TOEFL® iBT Sampler!", body: ["In this sampler, you will experience each of the task types in the test. You will complete one task per task type in each of the four sections of the test, reading, listening, writing and speaking."], actionLabel: "Continue" },
    { id: "hardware", kind: "hardware", section: "Pre-test", title: "Hardware Check", body: ["Before the test begins, we will check the microphone and headset volume.", "Please make sure your headset is on. Follow the instructions on each screen. Be sure that your microphone is properly positioned and adjusted to allow for the best possible recording. Speak directly into the microphone and in your normal speaking voice."], actionLabel: "Continue" },
    { id: "volume-info", kind: "volume_instructions", section: "Pre-test", title: "Adjusting the Volume", body: ["To adjust the volume, select the Volume icon at the top of the screen. The volume control will appear. Move the volume indicator to the left or the right to change the volume.", "To close the volume control, select the Volume icon again.", "You will be able to change the volume during the test if you need to."], actionLabel: "Continue" },
    { id: "volume-open", kind: "volume_adjusted", section: "Pre-test", title: "Adjusting the Volume", body: ["To adjust the volume, select the Volume icon at the top of the screen. The volume control will appear. Move the volume indicator to the left or the right to change the volume.", "To close the volume control, select the Volume icon again.", "You will be able to change the volume during the test if you need to."], actionLabel: "Continue" },
    { id: "mic-info", kind: "mic_instructions", section: "Pre-test", title: "Adjusting the Microphone", body: ["In order to check your microphone volume, you will speak into the microphone using your normal tone and volume. For best recording results, your voice level should remain generally within the Good Range. While you speak the microphone will adjust automatically."] },
    { id: "mic-record", kind: "mic_record", section: "Pre-test", title: "Microphone Check", body: ["There are several reasons why I would prefer to live in a large city. Some of the greatest advantages would include the number of job opportunities and career options, public transportation, greater diversity, and a wealth of entertainment. Also, large cities typically have a great deal to offer in terms of history, art and culture."] },
    { id: "mic-success", kind: "mic_success", section: "Pre-test", title: "Success", body: ["Your microphone volume has been successfully adjusted."], actionLabel: "Continue" },
    { id: "reading-intro", kind: "section_intro", section: "Reading", title: "Reading Section", body: ["In this mock test, you will answer 40 reading questions across two modules.", "There are three types of tasks in the Reading section."], taskRows: [["Complete the Words", "Fill in the missing letters in a paragraph."], ["Read in Daily Life", "Answer questions about everyday reading material."], ["Read an Academic Passage", "Answer questions about academic passages."]], actionLabel: "Begin" },
  ];

  const clozeOne = [
    "We know from drawings preserved in caves that early humans performed dances as a group activity. These dances may have helped communities ",
    " stories, strengthen social bonds, and mark important events. Because the drawings appear in many regions, researchers ",
    " that dance developed independently in different societies. Although the exact movements are unknown, the images provide useful ",
    " about how people expressed meaning before written language became common. In this way, dance offers a ",
    " into early social life. Archaeologists continue to compare these images with objects found nearby, hoping to ",
    " how music, clothing, and ritual may have been connected. Even incomplete evidence can ",
    " new questions about the past. As techniques improve, researchers may ",
    " additional details from pigments and cave surfaces. These discoveries could ",
    " our understanding of ancient communities and ",
    " why collective performance has remained important across human history.",
    "",
  ];
  steps.push({ id: "r-m1-cloze", kind: "reading_cloze", section: "Reading", module: 1, progressLabel: "Questions 1–10 of 40", clozeParts: clozeOne });

  dailyStimuli.forEach((item, index) => {
    steps.push({ id: `r-m1-daily-${index + 1}`, kind: "reading_daily", section: "Reading", module: 1, questionNumber: 11 + index, progressLabel: `Question ${11 + index} of 40`, stimulusTitle: item.title, stimulusBody: item.body, questionText: item.question, options: item.options, mediaType: "image", mediaLabel: "Stimulus image placeholder" });
  });

  academicQuestionsOne.forEach(([questionText, options], index) => {
    steps.push({ id: `r-m1-academic-${index + 1}`, kind: "reading_academic", section: "Reading", module: 1, questionNumber: 16 + index, progressLabel: `Question ${16 + index} of 40`, passageTitle: "Community Seed Libraries", passage: academicPassageOne, questionText, options: [...options] });
  });

  const clozeTwo = [
    "Public parks can improve city life in several ways. They provide space for exercise and relaxation, and they can ",
    " neighbors who might not otherwise meet. Trees and vegetation may also ",
    " summer temperatures by providing shade. However, planners must ",
    " how parks will be maintained over time. A well-designed park should ",
    " different age groups and physical abilities. It may also ",
    " space for events without disrupting quiet areas. Because land is limited, cities often ",
    " several possible locations before choosing one. Community surveys can ",
    " planners understand local needs. When residents participate in the process, they may ",
    " a stronger sense of ownership. Successful parks therefore ",
    " careful planning with long-term community involvement, and they can ",
    " an important role in public health.",
    "",
  ];
  steps.push({ id: "r-m2-cloze", kind: "reading_cloze", section: "Reading", module: 2, progressLabel: "Questions 21–30 of 40", clozeParts: clozeTwo });

  dailyStimuliTwo.forEach((item, index) => {
    steps.push({ id: `r-m2-daily-${index + 1}`, kind: "reading_daily", section: "Reading", module: 2, questionNumber: 31 + index, progressLabel: `Question ${31 + index} of 40`, stimulusTitle: item.title, stimulusBody: item.body, questionText: item.question, options: item.options, mediaType: "image", mediaLabel: "Stimulus image placeholder" });
  });

  academicQuestionsTwo.forEach(([questionText, options], index) => {
    steps.push({ id: `r-m2-academic-${index + 1}`, kind: "reading_academic", section: "Reading", module: 2, questionNumber: 36 + index, progressLabel: `Question ${36 + index} of 40`, passageTitle: "Urban Trees and Local Climate", passage: academicPassageTwo, questionText, options: [...options] });
  });

  steps.push(
    { id: "reading-end", kind: "section_end", section: "Reading", title: "End of Reading Section", body: ["You have completed the Reading section."], actionLabel: "Continue" },
    { id: "listening-intro", kind: "section_intro", section: "Listening", title: "Listening Section", body: ["In this mock test, you will answer 34 listening questions across two modules.", "You will not be able to return to previous questions."], taskRows: [["Listen and Choose a Response", "Select the best response to a question or statement."], ["Conversations", "Answer questions about short conversations."], ["Announcements and Academic Talks", "Answer questions about announcements and academic talks."]], actionLabel: "Begin" },
  );

  const responsePrompts = [
    "Could you send me the revised schedule before noon?",
    "Where is the chemistry lab located?",
    "Did you enjoy Professor Lee's lecture?",
    "How often does the seminar meet?",
    "Would you mind opening the window?",
    "When will the bookstore close today?",
    "Why did Maya leave the meeting early?",
    "Can I borrow your notes from yesterday?",
  ];
  const responseOptions = [
    choices("Sure, I'll email it this morning.", "The schedule is on the wall.", "I revised my major.", "Noon is usually busy."),
    choices("It's on the second floor.", "Chemistry is difficult.", "I studied last night.", "The lab report is due Friday."),
    choices("Yes, the examples were very clear.", "The lecture hall is large.", "I left my notebook there.", "She teaches on Tuesdays."),
    choices("Twice a week.", "In the student center.", "About thirty students.", "It starts next month."),
    choices("Of course.", "The weather was warm.", "I lost the key.", "It is made of glass."),
    choices("At six this evening.", "I bought a notebook.", "The store is nearby.", "It was very crowded."),
    choices("She had another appointment.", "The room is upstairs.", "I met her last week.", "The meeting was useful."),
    choices("Yes, I'll send you a copy.", "Yesterday was Wednesday.", "The notes are blue.", "I borrowed the book."),
  ];

  for (let module = 1 as 1 | 2; module <= 2; module = (module + 1) as 1 | 2) {
    for (let i = 0; i < 8; i += 1) {
      const q = module === 1 ? i + 1 : i + 19;
      steps.push({ id: `l-m${module}-response-${i + 1}`, kind: "listening_response", section: "Listening", module, questionNumber: q, progressLabel: `Question ${q} of 34`, questionText: responsePrompts[i], options: responseOptions[i], mediaType: "audio", mediaLabel: `Audio placeholder · response-${module}-${i + 1}.mp3` });
    }

    const groups = module === 1
      ? [
          { type: "conversation", count: 2, title: "Conversation", label: "Conversation audio placeholder" },
          { type: "conversation", count: 2, title: "Conversation", label: "Conversation audio placeholder" },
          { type: "announcement", count: 2, title: "Classroom Announcement", label: "Announcement audio placeholder" },
          { type: "academic", count: 4, title: "Academic Talk", label: "Academic talk audio placeholder" },
        ]
      : [
          { type: "conversation", count: 2, title: "Conversation", label: "Conversation audio placeholder" },
          { type: "announcement", count: 2, title: "Classroom Announcement", label: "Announcement audio placeholder" },
          { type: "academic", count: 4, title: "Academic Talk", label: "Academic talk audio placeholder" },
        ];

    let q = module === 1 ? 9 : 27;
    groups.forEach((group, groupIndex) => {
      const stimulusId = `l-m${module}-${group.type}-${groupIndex + 1}`;
      steps.push({ id: stimulusId, kind: "listening_stimulus", section: "Listening", module, stimulusTitle: group.title, mediaType: "audio", mediaLabel: group.label });
      for (let j = 0; j < group.count; j += 1) {
        steps.push({
          id: `${stimulusId}-q${j + 1}`,
          kind: "listening_question",
          section: "Listening",
          module,
          questionNumber: q,
          progressLabel: `Question ${q} of 34`,
          questionText: j === 0 ? "What is the main purpose of what you heard?" : "What detail does the speaker mention?",
          options: j === 0
            ? choices("To explain a change", "To complain about a policy", "To request money", "To introduce a new student")
            : choices("A schedule", "A refund", "A parking permit", "A laboratory result"),
          mediaLabel: group.label,
        });
        q += 1;
      }
    });
  }

  steps.push(
    { id: "listening-end", kind: "section_end", section: "Listening", title: "End of Listening Section", body: ["You have completed the Listening section."], actionLabel: "Continue" },
    { id: "writing-intro", kind: "section_intro", section: "Writing", title: "Writing Section", body: ["You will complete 12 writing questions."], taskRows: [["Build a Sentence", "Create a grammatical sentence."], ["Write an Email", "Write an email using information provided."], ["Write for an Academic Discussion", "Participate in an online discussion."]], actionLabel: "Continue" },
    { id: "writing-sentence-instructions", kind: "writing_instructions", section: "Writing", title: "Build a Sentence", body: ["Move the words in the boxes to create a grammatical sentence.", "You will complete 10 items."], actionLabel: "Begin" },
  );

  sentenceTasks.forEach((tokens, index) => {
    steps.push({ id: `w-sentence-${index + 1}`, kind: "build_sentence", section: "Writing", questionNumber: index + 1, progressLabel: `Question ${index + 1} of 12`, instruction: "Arrange the words to make a sentence.", tokens: [...tokens].reverse(), correctOrder: [...tokens] });
  });

  steps.push(
    { id: "writing-email-instructions", kind: "writing_instructions", section: "Writing", title: "Write an Email", body: ["You will read some information and use it to write an email.", "You will have 7 minutes to complete the task."], actionLabel: "Begin" },
    {
      id: "writing-email",
      kind: "email",
      section: "Writing",
      questionNumber: 11,
      progressLabel: "Question 11 of 12",
      emailScenario: [
        "A new poetry magazine has asked readers for submissions, and you decided to submit two poems.",
        "You had a problem using the online submission form and are not certain that your submissions were received.",
      ],
      requirements: ["Tell the editor what you like about the new magazine.", "Describe the problem you experienced.", "Ask about the status of your submissions."],
      recipient: "editor@sunshinepoetrymagazine.com",
      subject: "Problem using submission form",
    },
    { id: "writing-discussion-instructions", kind: "writing_instructions", section: "Writing", title: "Write for an Academic Discussion", body: ["A professor has posted a question and students have responded.", "Make a contribution to the discussion. You will have 10 minutes."], actionLabel: "Begin" },
    {
      id: "writing-discussion",
      kind: "discussion",
      section: "Writing",
      questionNumber: 12,
      progressLabel: "Question 12 of 12",
      professorPrompt: ["Some universities are considering whether students should be allowed to use AI tools for brainstorming during coursework.", "What policy would best support learning, and why?"],
      posts: [
        { name: "Mina", text: "I think limited use should be allowed if students explain how the tool helped them.", avatarLabel: "Avatar placeholder" },
        { name: "David", text: "I would rather require students to do the initial planning without AI.", avatarLabel: "Avatar placeholder" },
      ],
    },
    { id: "writing-end", kind: "section_end", section: "Writing", title: "End of Writing Section", body: ["You have completed the Writing section."], actionLabel: "Continue" },
    { id: "speaking-intro", kind: "section_intro", section: "Speaking", title: "Speaking Section", body: ["You will answer 11 speaking questions."], taskRows: [["Listen and Repeat", "Listen and repeat what you heard."], ["Take an Interview", "Answer questions from the interviewer."]], actionLabel: "Begin" },
    { id: "speaking-repeat-instructions", kind: "speaking_instructions", section: "Speaking", title: "Listen and Repeat", body: ["Listen carefully and repeat what you heard.", "No preparation time is provided."], actionLabel: "Begin" },
    { id: "speaking-repeat-scenario", kind: "speaking_scenario", section: "Speaking", title: "Listen and Repeat", body: ["You are learning to welcome visitors to a zoo.", "Listen to your manager and repeat what she says. Repeat only once."], mediaType: "image", mediaLabel: "Listen-and-repeat photo placeholder" },
  );

  const repeatLines = [
    "The aquarium opens at nine every morning.",
    "Please keep your ticket with you during the tour.",
    "The tropical birds are in the building across the courtyard.",
    "Food and drinks are allowed only in the picnic area.",
    "You can borrow a map from the information desk.",
    "Our weekend workshops are designed for visitors of all ages.",
    "Staff members in blue shirts can answer questions about the exhibits.",
  ];

  repeatLines.forEach((line, index) => {
    const questionNumber = index + 1;
    steps.push(
      { id: `s-repeat-${questionNumber}-prompt`, kind: "speaking_prompt", section: "Speaking", questionNumber, progressLabel: `Question ${questionNumber} of 11`, questionText: line, mediaType: "audio", mediaLabel: "Prompt audio + photo placeholder", responseSeconds: 6 },
      { id: `s-repeat-${questionNumber}-record`, kind: "speaking_record", section: "Speaking", questionNumber, progressLabel: `Question ${questionNumber} of 11`, questionText: line, mediaType: "audio", mediaLabel: "Prompt photo placeholder", responseSeconds: 6 },
      { id: `s-repeat-${questionNumber}-save`, kind: "speaking_save", section: "Speaking", questionNumber, progressLabel: `Question ${questionNumber} of 11`, mediaType: "audio", mediaLabel: "Recorded response placeholder", responseSeconds: 0 },
    );
  });

  steps.push(
    { id: "speaking-interview-instructions", kind: "speaking_instructions", section: "Speaking", title: "Take an Interview", body: ["An interviewer will ask you questions.", "Answer each question and say as much as you can in the time allowed."], actionLabel: "Begin" },
    { id: "speaking-interview-scenario", kind: "speaking_scenario", section: "Speaking", title: "Take an Interview", body: ["You have agreed to take part in a research study about urban life.", "You will have a short online interview with a researcher."], mediaType: "video", mediaLabel: "Interviewer video/photo placeholder" },
  );

  interviewQuestions.forEach((questionText, index) => {
    const questionNumber = 8 + index;
    steps.push(
      { id: `s-interview-${questionNumber}-prompt`, kind: "speaking_prompt", section: "Speaking", questionNumber, progressLabel: `Question ${questionNumber} of 11`, questionText, mediaType: "video", mediaLabel: "Interviewer video placeholder", responseSeconds: 45 },
      { id: `s-interview-${questionNumber}-record`, kind: "speaking_record", section: "Speaking", questionNumber, progressLabel: `Question ${questionNumber} of 11`, questionText, mediaType: "video", mediaLabel: "Interviewer video placeholder", responseSeconds: 45 },
      { id: `s-interview-${questionNumber}-save`, kind: "speaking_save", section: "Speaking", questionNumber, progressLabel: `Question ${questionNumber} of 11`, mediaType: "audio", mediaLabel: "Recorded response placeholder", responseSeconds: 0 },
    );
  });

  return steps;
}

export const MOCK_TOEFL = {
  id: "toefl-mock-01-ui",
  title: "TOEFL iBT Mock Test 01",
  subtitle: "2026-format UI preview",
  description: "A complete front-end mock with sample Reading, Listening, Writing, and Speaking data. Media files are represented by placeholders for now.",
  estimatedMinutes: 72,
  badge: "UI PREVIEW",
};
