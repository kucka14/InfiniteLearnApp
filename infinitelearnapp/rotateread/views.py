from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
import json

# Create your views here.

@ensure_csrf_cookie
def index(request):

    if request.user.is_authenticated:
        pass
    else:
        if request.method == 'POST':
            post_data = json.loads(request.body)
            user_email = post_data['user_email']
            return_data = {'user_email': user_email}
            return JsonResponse({'return_data': return_data})

    return render(request, 'rotateread/indexout.html', {})