"""
Dance Move Catalog for Python Backend
This mirrors the JavaScript MOVE_CATALOG for server-side choreography generation.
"""

MOVE_CATALOG = {
    'step_touch': {
        'name': 'Step Touch',
        'difficulty': 1,
        'bodyPart': 'Legs',
        'defaultBeats': 8,
        'description': 'Step to the side and touch feet together'
    },
    'body_roll': {
        'name': 'Body Roll',
        'difficulty': 2,
        'bodyPart': 'Full Body',
        'defaultBeats': 8,
        'description': 'Roll your body in a wave motion from chest to hips'
    },
    'arm_wave': {
        'name': 'Arm Wave',
        'difficulty': 2,
        'bodyPart': 'Arms',
        'defaultBeats': 8,
        'description': 'Create a wave motion from one hand across to the other'
    },
    'hip_sway': {
        'name': 'Hip Sway',
        'difficulty': 1,
        'bodyPart': 'Hips',
        'defaultBeats': 4,
        'description': 'Sway your hips side to side in rhythm'
    },
    'clap': {
        'name': 'Clap',
        'difficulty': 1,
        'bodyPart': 'Arms',
        'defaultBeats': 4,
        'description': 'Clap your hands together on the beat'
    },
    'turn': {
        'name': 'Turn',
        'difficulty': 2,
        'bodyPart': 'Full Body',
        'defaultBeats': 8,
        'description': 'Spin around in a full circle'
    },
    'jump': {
        'name': 'Jump',
        'difficulty': 2,
        'bodyPart': 'Full Body',
        'defaultBeats': 4,
        'description': 'Jump up with energy on the beat'
    },
    'slide': {
        'name': 'Slide',
        'difficulty': 1,
        'bodyPart': 'Legs',
        'defaultBeats': 4,
        'description': 'Slide your feet smoothly to one side'
    },
    'shoulder_pop': {
        'name': 'Shoulder Pop',
        'difficulty': 1,
        'bodyPart': 'Arms',
        'defaultBeats': 4,
        'description': 'Pop your shoulders up and down alternately'
    },
    'snap': {
        'name': 'Snap',
        'difficulty': 1,
        'bodyPart': 'Arms',
        'defaultBeats': 4,
        'description': 'Snap your fingers to the beat'
    },
    'point': {
        'name': 'Point',
        'difficulty': 1,
        'bodyPart': 'Arms',
        'defaultBeats': 4,
        'description': 'Point in different directions with style'
    },
    'stomp': {
        'name': 'Stomp',
        'difficulty': 1,
        'bodyPart': 'Legs',
        'defaultBeats': 4,
        'description': 'Stomp your feet powerfully on the beat'
    },
    'groove': {
        'name': 'Groove',
        'difficulty': 1,
        'bodyPart': 'Full Body',
        'defaultBeats': 8,
        'description': 'Feel the beat and move your whole body freely'
    },
    'sway': {
        'name': 'Sway',
        'difficulty': 1,
        'bodyPart': 'Full Body',
        'defaultBeats': 8,
        'description': 'Gently sway your body side to side'
    },
    'punch': {
        'name': 'Punch',
        'difficulty': 2,
        'bodyPart': 'Arms',
        'defaultBeats': 4,
        'description': 'Punch the air with power'
    },
    'shimmy': {
        'name': 'Shimmy',
        'difficulty': 2,
        'bodyPart': 'Arms',
        'defaultBeats': 8,
        'description': 'Shake your shoulders rapidly back and forth'
    },
    'twist': {
        'name': 'Twist',
        'difficulty': 1,
        'bodyPart': 'Hips',
        'defaultBeats': 8,
        'description': 'Twist your hips and feet like the classic dance'
    }
}

# Get list of move IDs
MOVE_IDS = list(MOVE_CATALOG.keys())

# Get moves by difficulty
def get_moves_by_difficulty(difficulty: int) -> list:
    """Get all moves with the specified difficulty level."""
    return [
        move_id for move_id, data in MOVE_CATALOG.items()
        if data['difficulty'] == difficulty
    ]

# Easy moves (difficulty 1)
EASY_MOVES = get_moves_by_difficulty(1)

# Medium moves (difficulty 2)
MEDIUM_MOVES = get_moves_by_difficulty(2)

# Get moves by body part
def get_moves_by_body_part(body_part: str) -> list:
    """Get all moves targeting the specified body part."""
    return [
        move_id for move_id, data in MOVE_CATALOG.items()
        if data['bodyPart'] == body_part
    ]
