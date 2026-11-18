async function captureTopicDesign(page) {
  const base = new URL(page.url()).origin;
  const catalog = [
    {
      id: "everyday",
      name: "Everyday",
      icon: "cup",
      description: "Easy. Familiar household and personal objects.",
      opt_in: false,
      count: 24,
    },
    {
      id: "food",
      name: "Food",
      icon: "pizza",
      description: "Easy. Foods, meals, snacks and drinks.",
      opt_in: false,
      count: 24,
    },
    {
      id: "animals",
      name: "Animals",
      icon: "paw",
      description: "Easy. Animals only, including insects and sea life.",
      opt_in: false,
      count: 24,
    },
    {
      id: "nature",
      name: "Nature",
      icon: "planet",
      description: "Easy. Plants, fungi, landscapes and natural phenomena.",
      opt_in: false,
      count: 24,
    },
    {
      id: "places",
      name: "Places",
      icon: "pin",
      description: "Easy. Buildings, venues and places around town.",
      opt_in: false,
      count: 24,
    },
    {
      id: "jobs",
      name: "Jobs",
      icon: "case",
      description: "Easy. Occupations and professional roles.",
      opt_in: false,
      count: 24,
    },
    {
      id: "travel",
      name: "Travel",
      icon: "plane",
      description:
        "Easy–medium. Trip essentials, transport and vacation experiences.",
      opt_in: false,
      count: 24,
    },
    {
      id: "movies",
      name: "Movies",
      icon: "film",
      description: "Easy–medium. Film-making, genres and story worlds.",
      opt_in: false,
      count: 24,
    },
    {
      id: "music",
      name: "Music",
      icon: "music",
      description: "Easy–medium. Instruments, songs and performance.",
      opt_in: false,
      count: 24,
    },
    {
      id: "sports",
      name: "Sports",
      icon: "ball",
      description: "Easy. Physical sports and athletic activities.",
      opt_in: false,
      count: 24,
    },
    {
      id: "gaming",
      name: "Gaming",
      icon: "game",
      description:
        "Medium; familiarity-dependent. Video-game mechanics and equipment.",
      opt_in: false,
      count: 24,
    },
    {
      id: "technology",
      name: "Technology",
      icon: "wifi",
      description:
        "Easy–medium. Digital devices, software and internet habits.",
      opt_in: false,
      count: 24,
    },
    {
      id: "chaos",
      name: "Everyday chaos",
      icon: "spark",
      description: "Medium; short phrases. Familiar everyday mishaps.",
      opt_in: false,
      count: 24,
    },
    {
      id: "hobbies",
      name: "Hobbies",
      icon: "brush",
      description:
        "Easy–medium. Leisure activities, crafts and creative interests.",
      opt_in: false,
      count: 24,
    },
    {
      id: "celebrations",
      name: "Celebrations",
      icon: "gift",
      description:
        "Medium; cultural familiarity varies. Parties, festivals and traditions.",
      opt_in: false,
      count: 24,
    },
    {
      id: "space",
      name: "Space & science",
      icon: "planet",
      description: "Medium. Astronomy, space exploration and related science.",
      opt_in: false,
      count: 24,
    },
    {
      id: "emotions",
      name: "Emotions",
      icon: "heart",
      description: "Medium. Feelings and emotional experiences.",
      opt_in: false,
      count: 24,
    },
    {
      id: "memory",
      name: "Psychology",
      icon: "brain",
      description:
        "Medium–challenge. Thinking, attention, learning and memory.",
      opt_in: false,
      count: 24,
    },
    {
      id: "social",
      name: "Social behavior",
      icon: "people",
      description: "Challenge. Group behavior and interpersonal dynamics.",
      opt_in: false,
      count: 24,
    },
    {
      id: "dating",
      name: "Relationships",
      icon: "heart",
      description: "Medium; opt-in relationship themes.",
      opt_in: true,
      count: 24,
    },
    {
      id: "puberty",
      name: "Body & puberty",
      icon: "body",
      description: "Medium; opt-in educational anatomy and puberty vocabulary.",
      opt_in: true,
      count: 24,
    },
    {
      id: "health",
      name: "Sex education",
      icon: "health",
      description:
        "Medium–challenge; opt-in sexual and reproductive health vocabulary.",
      opt_in: true,
      count: 24,
    },
    {
      id: "consent",
      name: "Consent",
      icon: "shield",
      description:
        "Medium–challenge; opt-in consent and personal-boundary concepts.",
      opt_in: true,
      count: 24,
    },
  ];
  const people = ["Alex", "Sam", "Mia", "Ben", "Jo", "Lee"].map((name, i) => ({
    id: name.toLowerCase(),
    name,
    ready: true,
    connected: true,
    left: false,
    points: 0,
    earned: 0,
    report_penalty: 0,
    report_round: null,
  }));
  const phaseNames = ["topic_voting", "topic_results", "topic_chosen"];
  const output = new URL(page.url()).searchParams.get("pass") || "before";
  const captures = [];
  for (let i = 0; i < 3; i++) {
    const state = {
      id: "topic-design",
      name: "Friday night",
      wifi: "Home Wi-Fi",
      phase: phaseNames[i],
      revision: 10,
      round_id: 3,
    score_session: { number: 1, target: 15, started: true, complete: false, winner_ids: [] },
    betting: { eligible: false, max_stake: 0, my_stake: null, original_vote: null, reading_streak: 0 },
      host_id: "alex",
      my_id: "alex",
      is_host: true,
      paused: false,
      pause_reason: null,
      topics: catalog.filter((t) => !t.opt_in).map((t) => t.id),
      catalog,
      players: people,
      private_role: null,
      role_ready: false,
      ready_count: 0,
      starting_id: null,
      vote_count: 0,
      my_vote: null,
      candidates: [],
      result: null,
      reporting: null,
      punishment: null,
      topic_vote: {
        my_topics: i === 0 ? null : ["food", "animals"],
        submitted_ids:
          i === 0 ? ["sam", "mia", "ben", "jo"] : people.map((p) => p.id),
        player_ids: people.map((p) => p.id),
        available_topics: catalog.filter((t) => !t.opt_in).map((t) => t.id),
        counts: i === 0 ? null : { food: 4, animals: 4, everyday: 2, music: 1 },
        leaders: i === 0 ? [] : ["animals", "food"],
        selected_topic: i === 2 ? "food" : null,
      },
    };
    for (const size of [
      { width: 390, height: 844 },
      { width: 360, height: 700 },
      { width: 430, height: 880 },
    ]) {
      const p = await page.context().newPage();
      await p.setViewportSize(size);
      await p.emulateMedia({ reducedMotion: "reduce" });
      await p.addInitScript(
        ({ state }) => {
          localStorage.clear();
          sessionStorage.clear();
          sessionStorage.setItem(
            "imposter.session.v1",
            JSON.stringify({
              session_id: "topic-design",
              credentials: {
                invitation: "fixture",
                token: "fixture",
                player_id: "alex",
                is_host: true,
              },
            }),
          );
          localStorage.setItem(
            "imposter.topic-draft.topic-design.alex.3",
            JSON.stringify(["food", "animals"]),
          );
        },
        { state },
      );
      await p.route("**/api/**", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(state),
        }),
      );
      await p.goto(base);
      await p
        .getByRole("heading", {
          name:
            i === 0
              ? "Choose the mood"
              : i === 1
                ? "It’s a tie."
                : "Food it is.",
          exact: true,
        })
        .waitFor();
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(500);
      const file = `output/playwright/topic-compare/${output}-${i + 1}-${size.width}.png`;
      await p.screenshot({ path: file });
      const metrics = await p.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        buttons: [...document.querySelectorAll("main .button.primary")].map(
          (e) => ({
            text: e.textContent,
            bottom: e.getBoundingClientRect().bottom,
          }),
        ),
        rows: [...document.querySelectorAll(".topic-also > div")].map((e) => ({
          text: e.textContent,
          bottom: e.getBoundingClientRect().bottom,
        })),
      }));
      captures.push({ file, ...size, ...metrics });
      await p.close();
    }
  }
  return captures;
}
