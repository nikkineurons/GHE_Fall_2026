import csv
import json

def process():
    creators = {}

    with open('provided_materials/2026datathon_interview_data.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            author = row['author_name'].strip()
            if not author:
                continue

            views = int(float(row['views'] or 0))
            likes = int(float(row['likes'] or 0))
            shares = int(float(row['shares'] or 0))
            comments = int(float(row['comments'] or 0))
            verified = row['author_verified'].strip().lower() == 'true'
            duration = int(float(row['duration_sec'] or 0))
            hashtag = row['primary_hashtag'].strip()
            caption = row['caption'].strip()
            upload_date = row['upload_date'].strip()
            video_id = row['video_id'].strip()
            music_name = row['music_name'].strip()
            music_is_original = row['music_is_original'].strip().lower() == 'true'

            if author not in creators:
                creators[author] = {
                    'author': author,
                    'verified': verified,
                    'videos': [],
                    'total_views': 0,
                    'total_likes': 0,
                    'total_shares': 0,
                    'total_comments': 0,
                    'hashtags': set(),
                }

            creators[author]['total_views'] += views
            creators[author]['total_likes'] += likes
            creators[author]['total_shares'] += shares
            creators[author]['total_comments'] += comments
            if hashtag:
                creators[author]['hashtags'].add(hashtag)

            creators[author]['videos'].append({
                'id': video_id,
                'views': views,
                'likes': likes,
                'shares': shares,
                'comments': comments,
                'duration_sec': duration,
                'hashtag': hashtag,
                'caption': caption,
                'upload_date': upload_date,
                'music_name': music_name,
                'music_is_original': music_is_original
            })

    creator_list = []
    for author, d in creators.items():
        d['hashtags'] = list(d['hashtags'])
        d['video_count'] = len(d['videos'])
        
        shares = d['total_shares']
        comments = d['total_comments']
        views = d['total_views']
        is_verified = d['verified']
        
        # Partnership Fit Scoring:
        # Unverified accounts are prime partnership targets (score 50 - 99%)
        # Verified accounts are low-priority targets with existing management commitments (capped at max 50%)
        if not is_verified:
            score = 50
            if shares >= 20000: score += 22
            elif shares >= 5000: score += 16
            elif shares >= 1000: score += 10
            elif shares >= 100: score += 4
            
            if comments >= 10000: score += 22
            elif comments >= 2000: score += 16
            elif comments >= 500: score += 10
            elif comments >= 50: score += 4
            
            if views >= 1000000: score += 5
            elif views >= 100000: score += 2
            
            score = min(score, 99)
        else:
            # Verified accounts: hard ceiling at 50
            score = 25
            if shares >= 20000: score += 10
            elif shares >= 5000: score += 7
            elif shares >= 1000: score += 4
            
            if comments >= 10000: score += 10
            elif comments >= 2000: score += 7
            elif comments >= 500: score += 4
            
            if views >= 1000000: score += 5
            score = min(score, 50)
            
        d['partnership_score'] = score
        
        # Rationale bullets
        pitch = []
        if not is_verified:
            pitch.append("Unverified account: Highly accessible partnership target with high collaboration receptiveness.")
        else:
            pitch.append("Verified account: Low-priority partnership target; established enterprise commitments and representation.")
            
        if shares >= 10000:
            pitch.append(f"High share volume ({shares:,} shares) signals organic peer distribution.")
        else:
            pitch.append(f"Generated {shares:,} total shares across published videos.")
            
        if comments >= 5000:
            pitch.append(f"Deep community discussion with {comments:,} total comments.")
        else:
            pitch.append(f"Active engagement with {comments:,} comments.")
            
        d['pitch_points'] = pitch

        creator_list.append(d)

    # Sort default by partnership_score then shares+comments
    creator_list.sort(key=lambda c: (c['partnership_score'], c['total_shares'] + c['total_comments']), reverse=True)

    overview = {
        'total_creators': len(creator_list),
        'total_videos': sum(c['video_count'] for c in creator_list),
        'total_shares': sum(c['total_shares'] for c in creator_list),
        'total_comments': sum(c['total_comments'] for c in creator_list),
        'total_views': sum(c['total_views'] for c in creator_list),
        'verified_count': sum(1 for c in creator_list if c['verified']),
        'unverified_count': sum(1 for c in creator_list if not c['verified']),
    }

    bundle = {
        'overview': overview,
        'creators': creator_list
    }

    with open('data_bundle.js', 'w', encoding='utf-8') as f:
        f.write('window.TIKTOK_DATA = ' + json.dumps(bundle, separators=(',', ':')) + ';')

    print("Generated data_bundle.js successfully. Total creators:", len(creator_list))
    
    # Check billie eilish score
    for c in creator_list:
        if 'billieeilish' in c['author'].lower():
            print(f"Verified Check: @{c['author']} score = {c['partnership_score']}% (verified={c['verified']})")

if __name__ == '__main__':
    process()
