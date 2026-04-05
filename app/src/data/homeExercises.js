// Static exercise library — no API needed
// Each exercise is a bodyweight/home-friendly movement

export const EXERCISE_CATEGORIES = [
  { id: 'chest', label: 'Chest', emoji: '💪' },
  { id: 'back', label: 'Back', emoji: '🔙' },
  { id: 'shoulders', label: 'Shoulders', emoji: '🎯' },
  { id: 'arms', label: 'Arms', emoji: '💪' },
  { id: 'core', label: 'Core', emoji: '🔥' },
  { id: 'legs', label: 'Legs', emoji: '🦵' },
  { id: 'fullbody', label: 'Full Body', emoji: '⚡' },
  { id: 'stretch', label: 'Stretching', emoji: '🧘' }
]

export const EXERCISES = [
  // === CHEST ===
  { id: 'pushup', name: 'Push-Up', category: 'chest', difficulty: 'beginner', muscles: ['Chest', 'Triceps', 'Shoulders'], equipment: 'none', reps: '3 × 12-15', steps: ['Start in plank position, hands shoulder-width apart', 'Lower your chest to the floor with elbows at 45°', 'Push back up to full arm extension', 'Keep core tight throughout'] },
  { id: 'diamond_pushup', name: 'Diamond Push-Up', category: 'chest', difficulty: 'intermediate', muscles: ['Inner Chest', 'Triceps'], equipment: 'none', reps: '3 × 8-12', steps: ['Place hands together under chest forming a diamond shape', 'Lower chest to your hands', 'Push up while squeezing chest', 'Keep elbows close to body'] },
  { id: 'decline_pushup', name: 'Decline Push-Up', category: 'chest', difficulty: 'intermediate', muscles: ['Upper Chest', 'Shoulders'], equipment: 'minimal', reps: '3 × 10-15', steps: ['Place feet on elevated surface (chair, step)', 'Hands on floor, shoulder-width apart', 'Lower chest to floor, then push up', 'The higher your feet, the harder it is'] },
  { id: 'wide_pushup', name: 'Wide Push-Up', category: 'chest', difficulty: 'beginner', muscles: ['Outer Chest', 'Shoulders'], equipment: 'none', reps: '3 × 12-15', steps: ['Place hands wider than shoulder-width', 'Lower chest to the floor slowly', 'Push back up, squeezing chest at the top', 'Keep core engaged and body straight'] },
  { id: 'archer_pushup', name: 'Archer Push-Up', category: 'chest', difficulty: 'advanced', muscles: ['Chest', 'Triceps', 'Core'], equipment: 'none', reps: '3 × 6-8 each side', steps: ['Wide hand placement on the floor', 'Shift weight to one arm and lower toward it', 'The other arm extends straight out', 'Push back up and alternate sides'] },

  // === BACK ===
  { id: 'superman', name: 'Superman Hold', category: 'back', difficulty: 'beginner', muscles: ['Lower Back', 'Glutes'], equipment: 'none', reps: '3 × 20-30 seconds', steps: ['Lie face down with arms extended forward', 'Lift arms, chest, and legs off the floor simultaneously', 'Hold at the top and squeeze your back', 'Lower slowly and repeat'] },
  { id: 'reverse_snow_angel', name: 'Reverse Snow Angel', category: 'back', difficulty: 'beginner', muscles: ['Upper Back', 'Rear Delts'], equipment: 'none', reps: '3 × 12', steps: ['Lie face down, arms at your sides', 'Lift chest slightly and sweep arms overhead in an arc', 'Reverse the motion back to sides', 'Keep arms slightly off the ground throughout'] },
  { id: 'inverted_row', name: 'Inverted Row (Table)', category: 'back', difficulty: 'intermediate', muscles: ['Lats', 'Biceps', 'Rear Delts'], equipment: 'minimal', reps: '3 × 8-12', steps: ['Lie under a sturdy table, grab the edge', 'Keep body straight and pull chest to the table', 'Lower slowly back down', 'The more horizontal you are, the harder it is'] },
  { id: 'doorframe_row', name: 'Doorframe Row', category: 'back', difficulty: 'beginner', muscles: ['Lats', 'Biceps'], equipment: 'minimal', reps: '3 × 10-15', steps: ['Hold both sides of a doorframe at chest height', 'Lean back with straight arms, feet close to frame', 'Pull yourself toward the frame squeezing back', 'Return to start position slowly'] },
  { id: 'pullup', name: 'Pull-Up', category: 'back', difficulty: 'advanced', muscles: ['Lats', 'Biceps', 'Forearms'], equipment: 'minimal', reps: '3 × 5-10', steps: ['Hang from a bar with overhand grip, shoulder-width', 'Pull yourself up until chin clears the bar', 'Lower slowly under control', 'Avoid swinging — strict form only'] },

  // === SHOULDERS ===
  { id: 'pike_pushup', name: 'Pike Push-Up', category: 'shoulders', difficulty: 'intermediate', muscles: ['Shoulders', 'Triceps'], equipment: 'none', reps: '3 × 8-12', steps: ['Start in a downward dog position (hips high)', 'Lower your head toward the floor by bending elbows', 'Push back up to starting position', 'Closer feet to hands = harder'] },
  { id: 'shoulder_tap', name: 'Shoulder Tap Plank', category: 'shoulders', difficulty: 'beginner', muscles: ['Shoulders', 'Core'], equipment: 'none', reps: '3 × 20 taps', steps: ['Start in a high plank position', 'Lift one hand to tap opposite shoulder', 'Replace and tap with the other hand', 'Keep hips as still as possible — anti-rotation'] },
  { id: 'arm_circle', name: 'Arm Circles', category: 'shoulders', difficulty: 'beginner', muscles: ['Shoulders', 'Rotator Cuff'], equipment: 'none', reps: '3 × 20 each direction', steps: ['Stand with arms extended at shoulder height', 'Make small circles forward for reps', 'Reverse direction', 'Increase circle size to progress'] },
  { id: 'wall_handstand', name: 'Wall Handstand Hold', category: 'shoulders', difficulty: 'advanced', muscles: ['Shoulders', 'Traps', 'Core'], equipment: 'minimal', reps: '3 × 20-30 seconds', steps: ['Kick up into a handstand facing the wall', 'Hands shoulder-width apart, fingers spread', 'Engage core and push through shoulders', 'Come down carefully when fatigued'] },
  { id: 'lateral_raise_band', name: 'Lateral Raise (Band)', category: 'shoulders', difficulty: 'intermediate', muscles: ['Side Delts'], equipment: 'bands', reps: '3 × 15-20', steps: ['Stand on resistance band, hold ends', 'Raise arms out to sides to shoulder height', 'Control the negative — 3 second lower', 'Keep a slight bend in elbows'] },

  // === ARMS ===
  { id: 'tricep_dip', name: 'Tricep Dip (Chair)', category: 'arms', difficulty: 'beginner', muscles: ['Triceps', 'Shoulders'], equipment: 'minimal', reps: '3 × 12-15', steps: ['Place hands on edge of a chair behind you', 'Extend legs out in front', 'Lower body by bending elbows to 90°', 'Push back up squeezing triceps'] },
  { id: 'chin_up', name: 'Chin-Up', category: 'arms', difficulty: 'intermediate', muscles: ['Biceps', 'Lats'], equipment: 'minimal', reps: '3 × 6-10', steps: ['Grab bar with underhand (palms facing you) grip', 'Pull up until chin clears the bar', 'Squeeze biceps at the top', 'Lower under control'] },
  { id: 'close_grip_pushup', name: 'Close-Grip Push-Up', category: 'arms', difficulty: 'intermediate', muscles: ['Triceps', 'Chest'], equipment: 'none', reps: '3 × 10-15', steps: ['Hands placed just inside shoulder width', 'Lower with elbows tracking along your sides', 'Push up while squeezing triceps', 'Keep core tight'] },
  { id: 'towel_curl', name: 'Towel Curl', category: 'arms', difficulty: 'beginner', muscles: ['Biceps'], equipment: 'minimal', reps: '3 × 12-15 each arm', steps: ['Loop a towel under one foot, hold both ends', 'Curl hands up while pressing foot down for resistance', 'Control the movement in both directions', 'More foot pressure = more resistance'] },
  { id: 'plank_up_down', name: 'Plank Up-Down', category: 'arms', difficulty: 'intermediate', muscles: ['Triceps', 'Core', 'Shoulders'], equipment: 'none', reps: '3 × 10 each arm', steps: ['Start in forearm plank position', 'Push up to high plank one arm at a time', 'Lower back to forearm plank', 'Alternate leading arm each rep'] },

  // === CORE ===
  { id: 'plank', name: 'Plank', category: 'core', difficulty: 'beginner', muscles: ['Abs', 'Obliques', 'Lower Back'], equipment: 'none', reps: '3 × 30-60 seconds', steps: ['Forearms on the floor, elbows under shoulders', 'Body in a straight line from head to heels', 'Squeeze abs and glutes to maintain position', 'Don\'t let hips sag or pike up'] },
  { id: 'bicycle_crunch', name: 'Bicycle Crunch', category: 'core', difficulty: 'beginner', muscles: ['Abs', 'Obliques'], equipment: 'none', reps: '3 × 20 each side', steps: ['Lie on back, hands behind head', 'Bring right elbow to left knee while extending right leg', 'Alternate sides in a cycling motion', 'Focus on rotation, not speed'] },
  { id: 'mountain_climber', name: 'Mountain Climbers', category: 'core', difficulty: 'intermediate', muscles: ['Core', 'Hip Flexors', 'Shoulders'], equipment: 'none', reps: '3 × 30 seconds', steps: ['Start in high plank position', 'Drive one knee toward chest rapidly', 'Switch legs in a running motion', 'Keep hips level and core braced'] },
  { id: 'leg_raise', name: 'Lying Leg Raise', category: 'core', difficulty: 'intermediate', muscles: ['Lower Abs', 'Hip Flexors'], equipment: 'none', reps: '3 × 12-15', steps: ['Lie flat on your back, hands under hips', 'Raise straight legs to 90 degrees', 'Lower slowly without touching the floor', 'Press lower back into the floor throughout'] },
  { id: 'hollow_hold', name: 'Hollow Body Hold', category: 'core', difficulty: 'advanced', muscles: ['Abs', 'Hip Flexors'], equipment: 'none', reps: '3 × 20-30 seconds', steps: ['Lie on your back, arms overhead, legs straight', 'Lift arms, shoulders, and legs off the floor', 'Create a "banana" shape — lower back pressed down', 'Hold and breathe — don\'t let anything touch the floor'] },

  // === LEGS ===
  { id: 'bodyweight_squat', name: 'Bodyweight Squat', category: 'legs', difficulty: 'beginner', muscles: ['Quads', 'Glutes', 'Core'], equipment: 'none', reps: '3 × 15-20', steps: ['Stand with feet shoulder-width apart', 'Sit back and down like into a chair', 'Go as low as mobility allows', 'Drive up through your heels'] },
  { id: 'lunge', name: 'Walking Lunge', category: 'legs', difficulty: 'beginner', muscles: ['Quads', 'Glutes', 'Hamstrings'], equipment: 'none', reps: '3 × 12 each leg', steps: ['Take a large step forward', 'Lower until both knees are at 90°', 'Push off front foot and step the back foot forward', 'Keep torso upright throughout'] },
  { id: 'bulgarian', name: 'Bulgarian Split Squat', category: 'legs', difficulty: 'intermediate', muscles: ['Quads', 'Glutes', 'Balance'], equipment: 'minimal', reps: '3 × 10 each leg', steps: ['Place rear foot on chair or step behind you', 'Lower into a single-leg squat', 'Front knee tracks over toes', 'Push through front heel to stand'] },
  { id: 'pistol_squat', name: 'Pistol Squat', category: 'legs', difficulty: 'advanced', muscles: ['Quads', 'Glutes', 'Balance'], equipment: 'none', reps: '3 × 5 each leg', steps: ['Stand on one leg, other leg extended forward', 'Squat down as low as possible on one leg', 'Keep extended leg off the floor', 'Stand back up — use a wall for balance if needed'] },
  { id: 'calf_raise', name: 'Single-Leg Calf Raise', category: 'legs', difficulty: 'beginner', muscles: ['Calves'], equipment: 'minimal', reps: '3 × 15-20 each leg', steps: ['Stand on the edge of a step on one foot', 'Lower heel below the step for a full stretch', 'Push up onto toes as high as possible', 'Hold the top for 1 second, lower slowly'] },

  // === FULL BODY ===
  { id: 'burpee', name: 'Burpee', category: 'fullbody', difficulty: 'intermediate', muscles: ['Full Body', 'Cardio'], equipment: 'none', reps: '3 × 10', steps: ['Stand, then drop into a squat with hands on floor', 'Jump feet back into plank position', 'Do a push-up (optional)', 'Jump feet forward and explode up with hands overhead'] },
  { id: 'bear_crawl', name: 'Bear Crawl', category: 'fullbody', difficulty: 'intermediate', muscles: ['Shoulders', 'Core', 'Quads'], equipment: 'none', reps: '3 × 30 seconds', steps: ['Start on all fours, knees 1 inch off ground', 'Move opposite hand and foot forward simultaneously', 'Keep hips level and core tight', 'Crawl forward and backward'] },
  { id: 'jumping_jack', name: 'Jumping Jacks', category: 'fullbody', difficulty: 'beginner', muscles: ['Full Body', 'Cardio'], equipment: 'none', reps: '3 × 30', steps: ['Stand with feet together, arms at sides', 'Jump feet out while bringing arms overhead', 'Jump back to starting position', 'Maintain a steady rhythm'] },
  { id: 'inchworm', name: 'Inchworm', category: 'fullbody', difficulty: 'beginner', muscles: ['Core', 'Hamstrings', 'Shoulders'], equipment: 'none', reps: '3 × 8', steps: ['Stand tall, hinge at hips, touch the floor', 'Walk hands out to plank position', 'Walk hands back to feet', 'Stand up and repeat'] },
  { id: 'squat_jump', name: 'Squat Jump', category: 'fullbody', difficulty: 'intermediate', muscles: ['Quads', 'Glutes', 'Calves'], equipment: 'none', reps: '3 × 10-12', steps: ['Start in a squat position', 'Explode upward jumping as high as possible', 'Land softly back into the squat', 'Absorb the landing through your legs'] },

  // === STRETCHING ===
  { id: 'cat_cow', name: 'Cat-Cow Stretch', category: 'stretch', difficulty: 'beginner', muscles: ['Spine', 'Core'], equipment: 'none', reps: '10 slow reps', steps: ['Start on all fours', 'Arch your back upward (cat) — tuck chin', 'Drop belly toward floor (cow) — look up', 'Flow between positions with your breath'] },
  { id: 'pigeon', name: 'Pigeon Pose', category: 'stretch', difficulty: 'beginner', muscles: ['Hip Flexors', 'Glutes'], equipment: 'none', reps: '60 seconds each side', steps: ['From plank, bring right knee to right wrist', 'Extend left leg straight behind you', 'Lower hips toward the floor', 'Fold forward for a deeper stretch'] },
  { id: 'seated_hamstring', name: 'Seated Hamstring Stretch', category: 'stretch', difficulty: 'beginner', muscles: ['Hamstrings', 'Lower Back'], equipment: 'none', reps: '45 seconds each leg', steps: ['Sit with one leg extended, the other bent', 'Reach toward extended foot', 'Keep back as straight as possible', 'Breathe deeply and relax into the stretch'] },
  { id: 'world_greatest', name: 'World\'s Greatest Stretch', category: 'stretch', difficulty: 'intermediate', muscles: ['Hip Flexors', 'Hamstrings', 'T-Spine'], equipment: 'none', reps: '5 each side', steps: ['Lunge forward with right foot', 'Place left hand on floor, right elbow to right ankle', 'Rotate right arm to the sky, opening chest', 'Return and switch sides'] },
  { id: 'child_pose', name: 'Child\'s Pose', category: 'stretch', difficulty: 'beginner', muscles: ['Back', 'Shoulders', 'Hips'], equipment: 'none', reps: '60-90 seconds', steps: ['Kneel on the floor, sit back on heels', 'Extend arms forward along the floor', 'Let forehead rest on the ground', 'Breathe deeply and relax everything'] }
]

export const REST_DAY_TIPS = [
  { icon: '🧘', title: 'Active Recovery', desc: 'Take a 20-minute walk or do the stretching routine. Light movement promotes blood flow to sore muscles.' },
  { icon: '💧', title: 'Hydrate Extra', desc: 'Aim for at least 3 liters of water today. Your muscles are 75% water — they need it to repair.' },
  { icon: '🥩', title: 'Hit Your Protein', desc: 'Rest days are STILL growth days. Eat at least 1.6g protein per kg bodyweight.' },
  { icon: '😴', title: 'Prioritize Sleep', desc: '7-9 hours tonight. Growth hormone peaks during deep sleep — this is when gains happen.' },
  { icon: '🧊', title: 'Cold Exposure', desc: '2-3 min cold shower reduces inflammation and boosts recovery. Start with 30 seconds.' },
  { icon: '📖', title: 'Visualize Tomorrow', desc: 'Review tomorrow\'s workout. Mental rehearsal activates the same neural pathways as training.' },
  { icon: '🫁', title: 'Breathing Work', desc: 'Try 4-7-8 breathing: Inhale 4 sec, hold 7 sec, exhale 8 sec. 4 rounds reduces cortisol.' },
  { icon: '🍌', title: 'Eat Anti-Inflammatory', desc: 'Load up on berries, leafy greens, fatty fish, and turmeric. These foods accelerate recovery.' },
  { icon: '🎯', title: 'Foam Roll', desc: 'Spend 10 minutes rolling quads, hamstrings, IT band, and upper back. Reduces DOMS significantly.' },
  { icon: '⚡', title: 'Mobility Work', desc: 'Work on ankle, hip, and thoracic spine mobility. Better mobility = better form = more gains.' },
]
