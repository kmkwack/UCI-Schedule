import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CURRENT_LEGAL_DOCUMENTS } from '../data/legal';

export type LegalDocumentType = 'terms' | 'privacy' | 'licenses';

type Section = {
  heading: string;
  body: string;
};

type LegalDocument = {
  title: string;
  updatedLabel: string;
  sections: Section[];
};

const DOCUMENTS: Record<LegalDocumentType, LegalDocument> = {
  terms: {
    title: 'Terms of Service',
    updatedLabel: `Last updated ${CURRENT_LEGAL_DOCUMENTS.effectiveLabel}`,
    sections: [
      {
        heading: 'Eligibility and Acceptance',
        body:
          'By using ClassMate, you agree to these Terms and our Privacy Policy. ClassMate is intended for students and school community members using supported university credentials. You may use the app only if you can legally agree to these Terms and comply with applicable law and your school’s policies.',
      },
      {
        heading: 'What ClassMate Provides',
        body:
          'ClassMate provides schedule planning, course browsing, manually entered grade-tracking tools, assignment deadline checklists, reviews, community posts, direct messaging, friend connections, notifications, and related campus-life features. Some features rely on third-party services, public or school-provided course data feeds, user-provided calendar links, or app-store infrastructure and may change, be delayed, or become unavailable at any time.',
      },
      {
        heading: 'Accounts and Security',
        body:
          'You are responsible for your account activity and for keeping your login credentials and device access secure. Do not share accounts, impersonate others, or access another person’s account without permission. If you believe your account has been compromised, use the in-app support path as soon as possible.',
      },
      {
        heading: 'Academic and School Information',
        body:
          'ClassMate is a convenience and planning tool only. Course listings, public section enrollment counts, enrollment status labels, grade calculations, reminders, maps, and similar information may be incomplete or inaccurate. ClassMate does not replace official registration, learning-management-system, advising, transcript, or registrar systems. Official registration, academic standing, financial obligations, transcripts, and institutional records must always be confirmed through your university’s official systems.',
      },
      {
        heading: 'User-Saved Timetables and ClassMates',
        body:
          'ClassMates and shared-class indicators are based on courses that users voluntarily save to their own ClassMate timetables, not on official enrollment rosters. ClassMate does not show everyone enrolled in a course. Shared classes are shown only between accepted friends and only when timetable visibility settings allow sharing. If a user makes their timetable private, their saved timetable and shared-class indicators are not shown to friends.',
      },
      {
        heading: 'LMS Assignment Imports',
        body:
          'If you paste a Canvas, Brightspace, Blackboard, Moodle, Sakai, Google Classroom, or other iCal feed link, ClassMate uses that link to import assignment-style calendar deadlines into a checklist. This feature is for deadlines only and does not add class meetings to your timetable. ClassMate does not access LMS rosters, submissions, grades, private course files, or official school records through this feature.',
      },
      {
        heading: 'Grades and Enrollment Counts',
        body:
          'Grades in ClassMate are manually entered by you for personal tracking and calculation. They are not imported from your university, Canvas, or any other LMS. Enrollment counts or status labels shown in course browsing come from public or aggregate course/section data when available and do not identify individual students.',
      },
      {
        heading: 'Your Content',
        body:
          'You retain ownership of content you submit, including posts, comments, reviews, direct messages, profile details, timetable names, and attachments. You give ClassMate a limited license to host, store, process, display, reproduce, and distribute that content only as needed to operate, secure, improve, moderate, and provide the app’s features.',
      },
      {
        heading: 'Reviews, Posts, Messages, and Attachments',
        body:
          'You are responsible for the content you submit. Do not post or send anything unlawful, harassing, threatening, defamatory, fraudulent, sexually explicit, hateful, infringing, invasive of privacy, or otherwise harmful. Do not upload malware, spam, deceptive links, or unauthorized files. If you submit a course review, it must reflect your genuine experience and must not be fake, bought, coordinated, or misleading.',
      },
      {
        heading: 'Community Rules and Acceptable Use',
        body:
          'You may not misuse ClassMate to stalk, bully, dox, impersonate, scrape, reverse engineer, interfere with the service, bypass restrictions, test vulnerabilities without permission, or exploit the app for commercial solicitation or unauthorized data collection. You also may not manipulate ratings, abuse reporting tools, or create duplicate or deceptive accounts.',
      },
      {
        heading: 'Moderation and Enforcement',
        body:
          'Because ClassMate includes user-generated content and social features, we may review reports, remove content, restrict visibility, block features, suspend accounts, or preserve information when reasonably necessary to investigate abuse, enforce these Terms, comply with law, or protect users and the service. We may act with or without prior notice when we believe action is needed.',
      },
      {
        heading: 'Visibility, Messaging, and Notifications',
        body:
          'Some information is shared according to the privacy and visibility settings available in the app, such as timetable-sharing preferences, accepted friend connections, board profile visibility, and social-notification settings. Direct messages and other social features are provided for convenience and community use, not for emergency communications. Notification timing and delivery are not guaranteed.',
      },
      {
        heading: 'Third-Party Services',
        body:
          'ClassMate may rely on third-party services such as university sign-in providers, Supabase, mapping tools, weather data, sports feeds, app-store infrastructure, and push-notification services. Those services operate under their own terms and policies, and we are not responsible for outages, content, or decisions made by third-party providers.',
      },
      {
        heading: 'Service Availability and Changes',
        body:
          'We may update, suspend, or discontinue any feature at any time. We may also modify these Terms as the app evolves. If changes are material, we may update the in-app legal documents or request renewed acceptance where appropriate. Continued use after an updated effective date means you accept the revised Terms.',
      },
      {
        heading: 'Disclaimers and Liability Limits',
        body:
          'ClassMate is provided on an “as is” and “as available” basis to the maximum extent allowed by law. We do not guarantee uninterrupted service, error-free operation, or the accuracy of user content or third-party data. To the maximum extent allowed by law, ClassMate and its operators are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of data, academic opportunity, reputation, or profits arising from your use of the app.',
      },
      {
        heading: 'Contact',
        body:
          'For questions about these Terms, account issues, moderation concerns, or legal requests, contact ClassMate through the support path provided in the app, including the support email route shown in Settings.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updatedLabel: `Last updated ${CURRENT_LEGAL_DOCUMENTS.effectiveLabel}`,
    sections: [
      {
        heading: 'Overview',
        body:
          'This Privacy Policy explains how ClassMate collects, uses, stores, and shares information when you use the app. It is written to reflect the app’s current features, including university sign-in, timetable planning, manually entered grade tracking, LMS assignment deadline imports, reviews, community posts, friend connections, direct messages, notifications, support, and moderation tools.',
      },
      {
        heading: 'Information We Collect',
        body:
          'Depending on how you use ClassMate, we may collect information such as your university email address, selected school, profile details you choose to add, accepted friend connections and friend requests, timetable visibility settings, user-saved timetable data, saved courses, manually entered grade-tracking entries, course reviews, posts, comments, direct messages, attachment metadata, reports you submit, notification preferences, push-token information, and limited device or app usage information needed to keep the service working.',
      },
      {
        heading: 'Information We Do Not Pull From Schools or LMSs',
        body:
          'ClassMate does not pull Canvas rosters, LMS participant lists, official enrollment records, student IDs, transcripts, official grades, Canvas submissions, private course files, or registrar records. Shared-class indicators are not based on official school rosters. Course browsing may use public or aggregate course/section data, such as section status or enrollment counts, but those counts do not identify individual students.',
      },
      {
        heading: 'Timetables, ClassMates, and Shared Classes',
        body:
          'ClassMates only works between users who have added each other as friends. Shared classes are calculated by comparing courses that each friend voluntarily saved in their own ClassMate timetable. If your timetable visibility is set to private, your timetable and shared-class matches are not visible to friends. ClassMate does not expose a list of everyone enrolled in a class.',
      },
      {
        heading: 'LMS Assignment Calendar Feeds',
        body:
          'If you paste an LMS calendar feed link, ClassMate fetches that feed to create assignment deadline checklist items. The current import stores the selected provider, feed link, parsed assignment deadlines, completion state, and last-sync time on your device. It is intended for assignment deadlines only, not class meetings, LMS rosters, Canvas submissions, or official grade data. Disconnecting the calendar removes the local feed link and cached assignment data from the app.',
      },
      {
        heading: 'Grades and GPA Tracking',
        body:
          'Grades and GPA calculations in ClassMate are based on values you manually enter for personal planning. They are not imported from your university, Canvas, or any other LMS. If you use grade tracking while signed in, ClassMate may store those manually entered grade values so they can be shown across app sessions.',
      },
      {
        heading: 'How We Use Information',
        body:
          'We use information to operate the app, personalize your experience, sync schedules and settings across sessions, power social and review features, deliver notifications you request, detect abuse, review reports, troubleshoot errors, improve performance, and comply with legal obligations. We do not describe the app as ad-supported, and this policy does not authorize selling your personal information for advertising.',
      },
      {
        heading: 'What Other Users Can See',
        body:
          'What other users can see depends on the feature and your settings. Accepted friends may see your saved timetable and shared-class matches only when your timetable visibility allows it. Board posts, comments, reviews, and messages are visible according to the audience and participants of those features. Information you choose to post, review, message, or share with friends may be copied, retained, or re-shared by recipients.',
      },
      {
        heading: 'How We Share Information',
        body:
          'We may share information with service providers and infrastructure partners that help run ClassMate, such as authentication providers, database and storage providers, notification services, and data providers used for maps, weather, or sports features. We may also disclose information when reasonably necessary to enforce our Terms, investigate abuse, respond to valid legal process, protect users, or prevent fraud, security incidents, or harm.',
      },
      {
        heading: 'Notifications and Device Permissions',
        body:
          'If you enable notifications, ClassMate may store your notification settings, permission status, and a device push token to send reminders or social alerts. Notification delivery depends on your device, OS permissions, and third-party push infrastructure, and may not always be immediate or successful.',
      },
      {
        heading: 'Reviews, Community Content, and Messages',
        body:
          'ClassMate stores the content you submit to social features so the app can display and manage it. This includes course reviews, posts, comments, messages, attachment references, and abuse reports. We may use this information to moderate content, investigate complaints, enforce the Terms, and maintain community safety.',
      },
      {
        heading: 'Data Retention',
        body:
          'We keep information for as long as reasonably necessary to provide the app, maintain records of community activity, resolve disputes, enforce our agreements, and meet legal, operational, or safety needs. Local assignment calendar feed data remains on your device until you disconnect the feed, clear app data, or delete the app. Some server data may remain in backups, logs, or safety records for a limited period after deletion requests or account changes.',
      },
      {
        heading: 'Your Choices and Requests',
        body:
          'You can control some information directly in the app, including profile details, timetable visibility, board profile exposure, notification settings, friend connections, and LMS calendar feed connection. You can initiate account deletion from Settings; deletion is intended to remove your account and account-related personal data that we are not required to keep. For account-access issues, privacy questions, or deletion requests, use the support contact provided in the app.',
      },
      {
        heading: 'Security',
        body:
          'We use reasonable administrative, technical, and organizational measures designed to protect information, including privacy-by-default sharing settings where practical and limiting LMS calendar use to user-provided deadline feeds. No system is completely secure. You are also responsible for protecting access to your device and your university account credentials.',
      },
      {
        heading: 'Children',
        body:
          'ClassMate is intended for school community use and is not designed for children. If the team plans to make the app available to younger users or market it to minors, the legal documents and in-app flows should be reviewed again for age-related privacy and content obligations before release.',
      },
      {
        heading: 'Changes to This Policy',
        body:
          'We may update this Privacy Policy as the app changes. If we make material changes, we may update the in-app document, revise the effective date, or request renewed acknowledgment where appropriate. Continued use after the effective date of an updated policy means you accept the revised version.',
      },
    ],
  },
  licenses: {
    title: 'Open Source Licenses',
    updatedLabel: 'Included software notices',
    sections: [
      {
        heading: 'Third-Party Libraries',
        body:
          'ClassMate is built with open source software including Expo, React Native, Supabase client libraries, react-native-maps, react-native-svg, and other community packages listed in the project dependencies.',
      },
      {
        heading: 'License Notice',
        body:
          'Each dependency remains subject to its own license terms. Before release, you should export or link the full dependency notices used by your shipped app build if you want a complete production-ready licenses page.',
      },
    ],
  },
};

type Props = {
  visible: boolean;
  document: LegalDocumentType;
  onClose: () => void;
  accentColor?: string;
};

export default function LegalDocumentModal({
  visible,
  document,
  onClose,
  accentColor = '#4169E1',
}: Props) {
  const content = DOCUMENTS[document];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#eef0f4',
          }}
        >
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827' }}>{content.title}</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{content.updatedLabel}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {content.sections.map((section) => (
            <View
              key={section.heading}
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: 16,
                padding: 18,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: '#e5e7eb',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
                {section.heading}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: '#4b5563' }}>{section.body}</Text>
            </View>
          ))}

          <View
            style={{
              backgroundColor: `${accentColor}12`,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: `${accentColor}22`,
            }}
          >
            <Text style={{ fontSize: 13, lineHeight: 20, color: '#374151' }}>
              These in-app legal documents describe the current ClassMate experience. You should review them
              periodically because we may update them as the app changes.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
