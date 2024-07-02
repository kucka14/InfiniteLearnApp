from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.urls import reverse
import os
import random
from PIL import Image
import shutil
import sys
from pdf2image import pdfinfo_from_path, convert_from_path
from django.utils.html import escape
from urllib.request import urlopen
from pypdf import PdfReader
from bs4 import BeautifulSoup
import ebooklib
from ebooklib import epub

def generate_sign_in_token(user):
    token = default_token_generator.make_token(user)
    return token

def send_sign_in_email(user):
    token = generate_sign_in_token(user)
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    sign_in_url = reverse('signin', kwargs={'uidb64': uidb64, 'token': token})
    sign_in_link = f'http://127.0.0.1:8000{sign_in_url}'

    subject = 'InfiniteLearn Sign-in Link'
    message = f'Click the link below to sign in to your account:\n\n{sign_in_link}'
    send_mail(subject, message, None, [user.email])

def prep_pdf(dirpath, filename):

    pdf_file = dirpath + '/' + filename

    os.mkdir(f'{dirpath}/images')

    print('Extracting metadata...')
    info = pdfinfo_from_path(pdf_file, userpw=None, poppler_path=None)
    maxPages = info["Pages"]

    print('Iterating through pages...')
    for page in range(1, maxPages+1, 10):

        print(f'Converting images for pages up to {page}...')
        images = convert_from_path(pdf_file, dpi=200, first_page=page, last_page = min(page+10-1,maxPages))
        
        print('Saving images...')
        for i in range(len(images)):
            images[i].save(f'{dirpath}/images/p' + str(page + i) + '.jpg', 'JPEG')
            
    dir_name = filename[:-4]
    os.mkdir(f'{dirpath}/{dir_name}')

    image_list = os.listdir(dirpath + '/images')
    image_list = sorted(image_list, key=lambda x: int(x[1:-4]))

    print('Opening all images...')
    image_list = [Image.open(dirpath + '/images/' + image_name) for image_name in image_list]

    print('Verifying all images same size...')
    image_size0 = image_list[0].size
    image_size1 = image_list[1].size
    image_size2 = image_list[2].size
    if image_size0 == image_size1:
        image_size = image_size0
    elif image_size1 == image_size2:
        image_size = image_size1
    elif image_size2 == image_size0:
        image_size = image_size2
    else:
        raise
    image_list = [img for img in image_list if img.size == image_size]

    for i in range(0, len(image_list), 20):

        high_range = i + 20
        if high_range > len(image_list):
            high_range = len(image_list)

        print(f'Creating blank megaimage for images {str(i + 1)} through {str(i + 20)}...')
        megaimage = Image.new('RGB', (image_size[0], image_size[1]*20), 'white')

        print('Pasting images into megaimage...')
        image_y = 0
        
        for j in range(i, high_range):
            img = image_list[j]
            megaimage.paste(img, (0, image_y))
            print('Pasted image', j + 1, 'out of', len(image_list))
            image_y += image_size[1]

        print(f'Outputting megaimage for images {str(i + 1)} through {str(i + 20)}...')
        megaimage.save(f'{dirpath}/{dir_name}/megaimage{i}.jpg')
        
    shutil.rmtree(dirpath + '/images')

def prep_learn_sequence(learn_folder):
    learn_items = []
    for file in os.listdir(learn_folder):
        if os.path.isfile(learn_folder + '/' + file):
            if file[-4:] == '.pdf':
                learn_items.append('000-' + file)
                learn_items.append('111-' + file)
            else:
                learn_items.append(file)
    if 'urls.txt' in learn_items:
        with open(learn_folder + '/urls.txt', 'r') as f:
            urls = f.readlines()
        for url in urls:
            learn_items.append(url)
        learn_items.remove('urls.txt')
    random.shuffle(learn_items)
    for learn_item in learn_items:
        if learn_item[-4:] == '.pdf' and learn_item[:4] == '000-' and learn_item[4:-4] not in os.listdir(learn_folder):
            prep_pdf(learn_folder, learn_item[4:])
    return learn_items

def get_fastread_text(learn_folder, learn_item_name):
    megaimage_dir = learn_folder + '/' + learn_item_name[:-4]
    filepaths = []
    for filename in os.listdir(megaimage_dir):
        filepath = megaimage_dir + '/' + filename
        filepaths.append(filepath)
    offset = len(megaimage_dir) + 10
    filepaths = sorted(filepaths, key=lambda x: int(x[offset:-4]))
    body_text = ''
    for filepath in filepaths:
        body_text += f'<img id="page-image" src="{filepath}">'
    return body_text

def clear_directory(directory_path):
    files = os.listdir(directory_path)
    for file in files:
        file_path = os.path.join(directory_path, file)
        if os.path.isfile(file_path):
            os.remove(file_path)

def parse_html(html):
    soup = BeautifulSoup(html, features="html.parser")
    text = soup.get_text()
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    text = '\n'.join(chunk for chunk in chunks if chunk)
    return text

def get_genread_text(file):
    if file[:4] == 'http':
        html = urlopen(file).read()
        text = parse_html(html)
    elif file[-4:] == '.pdf':
        pdf_reader = PdfReader(file)
        book_text_list = []
        clear_directory('media/genread_images')
        image_count = 0
        try:
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                for image_file_object in page.images:
                    image_extension = image_file_object.name.split('.')[-1]
                    with open(f'media/genread_images/img{image_count}.{image_extension}', 'wb') as f:
                        f.write(image_file_object.data)
                    book_text_list.append(f' d1ec9124e9c00620256ed5ee6bf66c28-img{image_count}.{image_extension} ')
                    image_count += 1
                book_text_list.append(page_text)
                book_text_list.append(' ad9b98955921d47b6ad91e92b6fe7634 ')
        except:
            pass
        text = '\n\n'.join(book_text_list)
    elif file[-4:] == '.txt':
        with open(file, 'r') as f:
            text = f.read()
    elif file[-5:] == '.epub':
        epub_book = epub.read_epub(file)
        book_text_list = []
        for item in epub_book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                html = item.get_content()
                text = parse_html(html)
                book_text_list.append(text)
        text = '\n\n'.join(book_text_list)
    return text

def translate_text(target: str, text: str) -> dict:
    """Translates text into the target language.

    Target must be an ISO 639-1 language code.
    See https://g.co/cloud/translate/v2/translate-reference#supported_languages
    """
    from google.cloud import translate_v2 as translate

    translate_client = translate.Client()

    if isinstance(text, bytes):
        text = text.decode("utf-8")

    # Text can also be a sequence of strings, in which case this method
    # will return a sequence of results for each text.
    result = translate_client.translate(text, target_language=target)

    # print("Text: {}".format(result["input"]))
    # print("Translation: {}".format(result["translatedText"]))
    # print("Detected source language: {}".format(result["detectedSourceLanguage"]))

    return result['translatedText']

def detect_language(text: str) -> dict:
    """Detects the text's language."""
    from google.cloud import translate_v2 as translate

    translate_client = translate.Client()

    # Text can also be a sequence of strings, in which case this method
    # will return a sequence of results for each text.
    result = translate_client.detect_language(text)

    # print(f"Text: {text}")
    # print("Confidence: {}".format(result["confidence"]))
    # print("Language: {}".format(result["language"]))

    return result['language']

def get_translate_text(resource_text):
    book_text_list = []
    book_text_in_words = resource_text.split(' ')
    book_text_in_chunks = [' '.join(book_text_in_words[i:i+50]) for i in range(0, len(book_text_in_words), 50)]
    translation_chunks = []
    translation_count = 0
    for chunk in book_text_in_chunks:
        translated_chunk = translate_text('en', chunk)
        book_text_list.append(f' d1ec9124e9c00620256ed5ee6bf66c28-translation{translation_count} ')
        book_text_list.append(chunk)
        book_text_list.append(' ad9b98955921d47b6ad91e92b6fe7634 ')
        translation_chunks.append(translated_chunk)
        translation_count += 1
    resource_text = '\n\n'.join(book_text_list)
    return resource_text, translation_chunks