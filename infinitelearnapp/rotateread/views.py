from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
import json
from .view_functions import send_sign_in_email, prep_learn_sequence, get_fastread_text, get_genread_text, detect_language, get_translate_text, create_ai_assistant_triplet, get_ai_response
from django.contrib.auth import login, logout
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.models import User
from django.utils.http import urlsafe_base64_decode
import re

# CONSTANTS
LEARN_FOLDER = 'media/resources/MCIT1'

ai_assistant_triplet = create_ai_assistant_triplet()

@ensure_csrf_cookie
def aiquestion(request):
    if request.method == 'POST':
        post_data = json.loads(request.body)
        question = post_data['question']
        target = post_data['target']
        response = get_ai_response(question, ai_assistant_triplet)
        return_data = {
            'response': response,
            'target': target
        }
        return JsonResponse({'return_data': return_data})

def index(request):

    if request.user.is_authenticated:
        
        if request.method == 'POST':

            post_data = json.loads(request.body)
            resource_name = post_data['resource_name']

            if resource_name[-4:] == '.pdf':

                if resource_name[:3] == 'fr|':
                    display_type = 'fastread'
                    resource_text = get_fastread_text(LEARN_FOLDER, resource_name[3:])
                elif resource_name[:3] == 'gr|':
                    display_type = 'genread'
                    resource_text = get_genread_text(LEARN_FOLDER + '/' + resource_name[3:])
                else:
                    raise

            elif resource_name[:4] == 'http':
                display_type = 'genread'
                resource_text = get_genread_text(resource_name)

            elif resource_name[-5:] == '.epub':
                display_type = 'genread'
                resource_text = get_genread_text(LEARN_FOLDER + '/' + resource_name)

            elif resource_name[-4:] == '.txt':
                display_type = 'genread'
                resource_text = get_genread_text(LEARN_FOLDER + '/' + resource_name)

            elif resource_name[-4:] == '.mp4':
                display_type = 'video'
                resource_text = LEARN_FOLDER + '/' + resource_name

            if display_type == 'genread':
                if detect_language(resource_text[:1000]) == 'es':
                    #if resource_text had identifiers for images, remove them
                    resource_text = re.sub(' d1ec9124e9c00620256ed5ee6bf66c28.*? ', ' ', resource_text)
                    resource_text, translation_chunks = get_translate_text(resource_text)
                    return_data = {
                        'display_type': 'translate',
                        'resource_text': resource_text,
                        'translation_chunks': translation_chunks
                    }
                    return JsonResponse({'return_data': return_data})

            return_data = {
                'display_type': display_type,
                'resource_text': resource_text
            }
            return JsonResponse({'return_data': return_data})

        else: #if request.method != 'POST'
            learn_items = prep_learn_sequence(LEARN_FOLDER)
            return render(request, 'rotateread/indexin.html', {
                'learn_items': learn_items,
            })
    else: #if request.user.is_not_authenticated
        if request.method == 'POST':
            post_data = json.loads(request.body)
            username = post_data['user_email']

            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                user = User.objects.create_user(username)
                user.email = username
                user.save()
            send_sign_in_email(user)

            return_data = {'status': 'success'}
            return JsonResponse({'return_data': return_data})
        else: #if request.method != 'POST'
            return render(request, 'rotateread/indexout.html', {})

def signin(request, uidb64, token):
    pk = int(urlsafe_base64_decode(uidb64).decode())
    user = get_object_or_404(User, pk=pk)
    if default_token_generator.check_token(user, token):
        login(request, user)
        return redirect('index')
    else:
        return HttpResponse('That was an invalid sign-in link.', status=400)
    
def signout(request):
    logout(request)
    return redirect('index')
