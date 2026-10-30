FROM php:8.2-apache

# PHP MySQL extensions
RUN docker-php-ext-install pdo pdo_mysql mysqli
RUN a2enmod rewrite

# Copy the whole app to /var/www/app.
# Only public/ should be web-served; config/ and includes/ stay outside the web root.
COPY . /var/www/app

# Point Apache's document root at the public/ folder
RUN rm -rf /var/www/html \
    && ln -s /var/www/app/public /var/www/html \
    && chown -R www-data:www-data /var/www/app

EXPOSE 80
