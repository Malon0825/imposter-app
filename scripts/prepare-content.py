"""Build the offline editorial word/hint catalog from the reviewed topic draft."""
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
ids = ['everyday','food','animals','places','jobs','travel','movies','music','sports','gaming','technology','chaos','hobbies','celebrations','space','emotions','memory','social','dating','puberty','health','consent']
icons = ['cup','pizza','paw','pin','case','plane','film','music','ball','game','wifi','spark','brush','gift','planet','heart','brain','people','heart','body','health','shield']
names = ['Everyday','Food','Animals','Places','Jobs','Travel','Movies','Music','Sports','Gaming','Technology','Everyday chaos','Hobbies','Celebrations','Space & science','Emotions','Psychology','Social behavior','Relationships','Body & puberty','Sex education','Consent']
# Indirect starting associations, intentionally not definitions. Local playtesting should refine difficulty.
hints = '''Pocket|Weather|Reflection|Comfort|Routine|Craft|Access|Evening|Journey|Couch
Slice|Rice|Parcel|Fold|Spice|Bowl|Summer|Cinema|Morning|Straw
Arms|Colony|Garden|Memory|Leap|Night|Desert|Shade|Mist|Mountain
Quiet|Basket|Corridor|Tickets|Morning|Queue|Glass|Laughter|Chair|Alarm
Heat|Team|Uniform|Board|Questions|Seasons|Chair|Deadline|Sketch|Surprise
Stamp|Handle|Gate|Stars|Memory|Skin|Bunk|Playlist|Clock|Deck
Cape|Crowd|Night|Paradox|Surprise|Plan|Treasure|Creak|Journey|Evidence
Friends|Strings|Rhythm|Stage|Crowd|Harmony|Conductor|Mix|Pair|Bedtime
Bounce|Pitch|Feathers|Lanes|Pins|Gloves|Waves|Strategy|Balance|Net
Return|Pattern|Chest|Progress|Identity|Precision|Energy|Buttons|Freedom|Detour
Remix|Reaction|Secret|Signal|Receipt|Audience|Notifications|Filter|Conversation|Charge
Alarm|Audience|Socket|Carousel|Crickets|Schedule|Sleeve|Calendar|Smoke|Timing
Seasons|Loops|Light|Hands|Fold|Oven|Layers|Patience|Reflection|Misdirection
Candles|Sky|Promise|Cap|Disguise|Glow|Street|Ribbon|Midnight|Stories
Shade|Tides|Dust|Rings|Tail|Fragments|Suit|Launch|Lens|Weight
Comparison|Anticipation|Blush|Exhale|Questions|Obstacle|Achievement|Distance|Appreciation|Unexpected
Window|Familiar|Noise|Repetition|Goal|Keepsake|Focus|Past|Possibility|Practice
Crowd|Arrival|Uniform|Pitch|Shared|Race|Perspective|Reliability|Assumption|Selective
Butterflies|Introductions|Signals|Distance|Closure|Calendar|Promise|Surprise|Envelope|Introduction
Change|Calendar|Response|Cycle|Anatomy|Pair|Glands|Cells|Development|Growth
Wrapper|Planning|Comfort|Result|Device|Appointment|Laboratory|Timing|Checkup|Wellbeing
Choice|Limits|Curtain|Ask|Decline|Dignity|Listening|Distance|Together|Control'''.splitlines()
sections = re.split(r'### \d+\. ', (root/'TOPICS.md').read_text(encoding='utf-8'))[1:]
packs=[]
for index, section in enumerate(sections):
    paragraphs = section.split('\n\n')
    words = paragraphs[2].strip().rstrip('.').split(', ')
    clue = hints[index].split('|')
    assert len(words)==len(clue)==10
    pairs=[{'word':w,'hint':h} for w,h in zip(words,clue)]
    if ids[index]=='animals': pairs.append({'word':'Dog','hint':'Paws'})
    packs.append({'id':ids[index],'name':names[index],'icon':icons[index], 'description':paragraphs[1].split('. ')[0]+'.','opt_in':index>=18,'words':pairs})
path=root/'crates/party-core/content/topics.json'
path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(json.dumps(packs,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(packs)} packs; {sum(len(p["words"]) for p in packs)} paired words')
