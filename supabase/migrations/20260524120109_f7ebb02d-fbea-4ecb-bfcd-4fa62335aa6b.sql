DELETE FROM checklist_template_items WHERE template_id IN (SELECT id FROM checklist_templates WHERE business_role_id='cf8e14fa-f869-4be4-984a-dcd92bd8af5a');
DELETE FROM checklist_template_photos WHERE template_id IN (SELECT id FROM checklist_templates WHERE business_role_id='cf8e14fa-f869-4be4-984a-dcd92bd8af5a');
DELETE FROM checklist_templates WHERE business_role_id='cf8e14fa-f869-4be4-984a-dcd92bd8af5a';
DELETE FROM business_roles WHERE id='cf8e14fa-f869-4be4-984a-dcd92bd8af5a';