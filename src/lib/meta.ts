import { LOGO_URL } from "./config";

export function updateMetaTags(title: string, description: string, image?: string) {
  document.title = title;
  
  const tags: Record<string, string> = {
    "og:title": title,
    "og:description": description,
    "og:image": image || LOGO_URL,
    "twitter:title": title,
    "twitter:description": description,
    "twitter:image": image || LOGO_URL,
  };

  Object.entries(tags).forEach(([property, value]) => {
    if (!value) return;
    
    // OG tags use the 'property' attribute, Twitter tags use 'name'
    const isOg = property.startsWith("og:");
    const selector = isOg 
      ? `meta[property="${property}"]` 
      : `meta[name="${property}"]`;
      
    let element = document.querySelector(selector);
    if (!element) {
      element = document.createElement("meta");
      if (isOg) {
        element.setAttribute("property", property);
      } else {
        element.setAttribute("name", property);
      }
      document.head.appendChild(element);
    }
    element.setAttribute("content", value);
  });
}
