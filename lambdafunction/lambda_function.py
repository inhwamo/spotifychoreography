
import json
import os
import requests
def lambda_handler(event, context):
    allowed_origins = ['https://www.inhwamo.com', 'https://inhwamo.com', 'https://www.inhwamo.com/spotifychoreography']
    origin = event.get('headers', {}).get('origin', '')

    if origin in allowed_origins:
        access_control_allow_origin = origin
    else:
        access_control_allow_origin = ''

    response = {
        'statusCode': 400,
        'body': json.dumps({
            'error': 'Invalid request'
        }),
        'headers': {
            'Access-Control-Allow-Origin': access_control_allow_origin,
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        }
    }
    # Should be a GET request
    if event['httpMethod'] == 'GET':
        try:
            client_id = os.environ['CLIENT_ID']
            client_secret = os.environ['CLIENT_SECRET']

            # Sends a POST request to Spotify to get an access token    
            auth_response = requests.post(
                'https://accounts.spotify.com/api/token',
                data={
                    'grant_type': 'client_credentials',
                    'client_id': client_id,
                    'client_secret': client_secret,
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )

            access_token = auth_response.json()['access_token']

            response = {
                'statusCode': 200,
                'body': json.dumps({
                    'access_token': access_token
                }),
                'headers': {
                    'Access-Control-Allow-Origin': access_control_allow_origin,
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                }
            }
        except Exception as e:
            response = {
                'statusCode': 500,
                'body': json.dumps({
                    'error': str(e)
                }),
                'headers': {
                    'Access-Control-Allow-Origin': access_control_allow_origin,
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                }
            }

    return response
