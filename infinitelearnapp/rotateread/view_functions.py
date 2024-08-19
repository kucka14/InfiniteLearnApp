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
from pdf2image import pdfinfo_from_path, convert_from_path
from urllib.request import urlopen
from pypdf import PdfReader
from bs4 import BeautifulSoup
import ebooklib
from ebooklib import epub
from openai import OpenAI

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
    try:
        image_size1 = image_list[1].size
        image_size2 = image_list[2].size
    except IndexError:
        image_size = image_size0
    else:
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
    resource_names = []
    for file in os.listdir(learn_folder):
        if os.path.isfile(learn_folder + '/' + file):
            if file[-4:] == '.pdf':
                resource_names.append('fr|' + file)
                resource_names.append('gr|' + file)
            else:
                resource_names.append(file)
    if 'urls.txt' in resource_names:
        with open(learn_folder + '/urls.txt', 'r') as f:
            urls = f.readlines()
        for url in urls:
            resource_names.append(url.strip())
        resource_names.remove('urls.txt')
    for resource_name in resource_names:
        if resource_name[-4:] == '.pdf' and resource_name[:3] == 'fr|' and resource_name[3:-4] not in os.listdir(learn_folder):
            prep_pdf(learn_folder, resource_name[3:])
    return resource_names

def get_fastread_text(learn_folder, resource_name):
    megaimage_dir = learn_folder + '/' + resource_name[:-4]
    filepaths = []
    for filename in os.listdir(megaimage_dir):
        filepath = megaimage_dir + '/' + filename
        filepaths.append(filepath)
    offset = len(megaimage_dir) + 10
    filepaths = sorted(filepaths, key=lambda x: int(x[offset:-4]))
    resource_text = ''
    for filepath in filepaths:
        resource_text += f'<img id="page-image" src="{filepath}">'
    return resource_text

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
        resource_text = parse_html(html)
    elif file[-4:] == '.pdf':
        pdf_reader = PdfReader(file)
        resource_text_list = []
        clear_directory('media/genread_images')
        image_count = 0
        try:
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                for image_file_object in page.images:
                    image_extension = image_file_object.name.split('.')[-1]
                    with open(f'media/genread_images/img{image_count}.{image_extension}', 'wb') as f:
                        f.write(image_file_object.data)
                    resource_text_list.append(f' d1ec9124e9c00620256ed5ee6bf66c28-img{image_count}.{image_extension} ')
                    image_count += 1
                resource_text_list.append(page_text)
                resource_text_list.append(' ad9b98955921d47b6ad91e92b6fe7634 ')
        except Exception as e:
            print(e)
        resource_text = '\n\n'.join(resource_text_list)
    elif file[-4:] == '.txt':
        with open(file, 'r') as f:
            resource_text = f.read()
    elif file[-5:] == '.epub':
        epub_book = epub.read_epub(file)
        resource_text_list = []
        for item in epub_book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                html = item.get_content()
                text = parse_html(html)
                resource_text_list.append(text)
        resource_text = '\n\n'.join(resource_text_list)
    return resource_text

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
    resource_text_list = []
    resource_text_in_words = resource_text.split(' ')
    resource_text_in_chunks = [' '.join(resource_text_in_words[i:i+50]) for i in range(0, len(resource_text_in_words), 50)]
    translation_chunks = []
    translation_count = 0
    for chunk in resource_text_in_chunks:
        translated_chunk = translate_text('en', chunk)
        resource_text_list.append(f' d1ec9124e9c00620256ed5ee6bf66c28-translation{translation_count} ')
        resource_text_list.append(chunk)
        resource_text_list.append(' ad9b98955921d47b6ad91e92b6fe7634 ')
        translation_chunks.append(translated_chunk)
        translation_count += 1
    resource_text = '\n\n'.join(resource_text_list)
    return resource_text, translation_chunks

def create_ai_assistant_triplet():
    client = OpenAI()
    assistant = client.beta.assistants.create(
        name="General Tutor",
        instructions="You are a general tutor. You supply answers, explanations, and explanations in a succinct form. All responses should be in LaTeX, using $$...$$ for displayed mathematics and \(...\) for in-line mathematics.",
        model="gpt-3.5-turbo",
        tools=[
        {"type": "code_interpreter"}
        ],
    )
    thread = client.beta.threads.create()
    return [client, thread, assistant]

def get_ai_response(question, ai_assistant_triplet):
    if question.strip() == '':
        return
    client = ai_assistant_triplet[0]
    thread = ai_assistant_triplet[1]
    assistant = ai_assistant_triplet[2]
    message = client.beta.threads.messages.create(
        thread_id=thread.id,
        role='user',
        content=question
    )
    run = client.beta.threads.runs.create_and_poll(
        thread_id=thread.id,
        assistant_id=assistant.id,
    )
    if run.status == 'completed': 
        messages = client.beta.threads.messages.list(
            thread_id=thread.id
        )
        try:
            response = messages.data[0].content[0].text.value
        except:
            response = 'AI response could not be shown. Try another query.'
    else:
        response = run.status
    return response