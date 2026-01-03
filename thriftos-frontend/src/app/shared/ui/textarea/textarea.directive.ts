import { Directive, ElementRef, OnInit, Renderer2, inject } from '@angular/core';

@Directive({
  selector: 'textarea[appTextarea], textarea[uiTextarea]',
  standalone: true,
})
export class TextareaDirective implements OnInit {
  private readonly elementRef = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    this.renderer.addClass(this.elementRef.nativeElement, 'textarea');
  }
}
