from django.urls import path
from . import views
from django.conf.urls.static import static
from django.conf import settings

urlpatterns = [
    path('', views.index, name='index'),
    path('signin/<uidb64>/<token>/', views.signin, name='signin'),
    path('signout/', views.signout, name='signout'),
    path('ee8c78ce53297da92f1fccd7eb5a773a/', views.aiquestion, name='aiquestion')
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)