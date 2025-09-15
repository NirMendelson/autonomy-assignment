const mongoose = require('mongoose');
const _ = require('lodash');

const { Schema } = mongoose;

const mongoSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  subject: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
});

const EmailTemplate = mongoose.model('EmailTemplate', mongoSchema);

async function insertTemplates(t) {
  const templates = [
    {
      name: 'welcome',
      subject: t('email.welcome_subject'),
      message: `<%= userName %>,
        <p>
          ${t('email.welcome_intro')}
        </p>
        <p>
          ${t('email.welcome_books_link')}
        </p>

        ${t('email.welcome_signature_names')}
        ${t('email.welcome_signature_team')}
      `,
    },
  ];

  for (const template of templates) { // eslint-disable-line
    const et = await EmailTemplate.findOne({ name: template.name }); // eslint-disable-line

    const message = template.message.replace(/\n/g, '').replace(/[ ]+/g, ' ').trim();

    if (!et) {
      EmailTemplate.create({ ...template, message });
    } else if (et.subject !== template.subject || et.message !== message) {
      EmailTemplate.updateOne({ _id: et._id }, { $set: { message, subject: template.subject } }).exec();
    }
  }
}

async function getEmailTemplate(name, params, t) {
  const et = await EmailTemplate.findOne({ name });

  if (!et) {
    throw new Error(t('error.email_template_not_found'));
  }

  return {
    message: _.template(et.message)(params),
    subject: _.template(et.subject)(params),
  };
}

exports.insertTemplates = insertTemplates;
exports.getEmailTemplate = getEmailTemplate;